import type { GenericSchema } from 'valibot';
import { ValifetchError } from '../errors/ValifetchError';
import type {
  AfterParseResponseHook,
  CallableInstance,
  CancellablePromise,
  DebugEvent,
  DebugOption,
  Hooks,
  HttpMethod,
  NormalizedOptions,
  ValifetchInstance,
  ValifetchInstanceOptions,
} from '../types';
import { buildUrl, mergeSearchParams } from '../url/builder';
import {
  runAfterParseResponseHooks,
  runAfterResponseHooks,
  runBeforeErrorHooks,
  runBeforeRequestHooks,
  runBeforeRetryHooks,
  stop,
} from './hooks';
import { buildRequest, HOOK_KEYS, type RequestOptions } from './request';
import {
  checkResponseStatus,
  parseJsonResponse,
  parseSSEResponse,
  wrapResponseWithProgress,
} from './response';
import {
  calculateRetryDelay,
  getRetryAfterDelay,
  normalizeRetryOptions,
  shouldRetry,
  shouldRetryNetworkError,
  sleep,
} from './retry';

// Frozen so the shared default options object can never be mutated by accident.
const EMPTY = Object.freeze({}) as RequestOptions;

/**
 * Sentinel abort reason for the timeout path. Compared by identity so a caller
 * aborting with their own `Error('Request timed out')` still yields ABORT_ERROR.
 */
class TimeoutAbortError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'TimeoutAbortError';
  }
}

async function handleResponse<T>(
  response: Response,
  request: Request,
  options: NormalizedOptions,
  responseSchema: GenericSchema | undefined,
  validateResponse: boolean,
  throwHttpErrors: boolean,
  afterParseResponseHooks?: AfterParseResponseHook[]
): Promise<T> {
  const responseType = options.responseType ?? 'json';
  await checkResponseStatus(response, request, throwHttpErrors);

  // Pipe body through a progress-tracking TransformStream before parsing.
  // Skip for 'stream', 'raw', and 'sse' since the caller owns the body/iterable.
  const trackedResponse =
    options.onDownloadProgress &&
    responseType !== 'stream' &&
    responseType !== 'raw' &&
    responseType !== 'sse'
      ? wrapResponseWithProgress(response, options.onDownloadProgress)
      : response;

  // Body reads can reject (malformed multipart, detached stream, ...); surface
  // those as PARSE_ERROR instead of leaking the raw platform TypeError.
  const read = async <R>(kind: string, body: Promise<R>): Promise<R> => {
    try {
      return await body;
    } catch (error) {
      throw new ValifetchError({
        message: `Failed to parse response as ${kind}`,
        code: 'PARSE_ERROR',
        request,
        response,
        cause: error,
      });
    }
  };

  let data: T;

  switch (responseType) {
    case 'stream':
      return response.body as T;
    case 'raw':
      return response as T;
    case 'sse':
      return parseSSEResponse(response.body) as T;
    case 'text':
      data = (await read('text', trackedResponse.text())) as T;
      break;
    case 'blob':
      data = (await read('blob', trackedResponse.blob())) as T;
      break;
    case 'arrayBuffer':
      data = (await read('arrayBuffer', trackedResponse.arrayBuffer())) as T;
      break;
    case 'formData':
      data = (await read('formData', trackedResponse.formData())) as T;
      break;
    case 'json':
    default:
      data = (await parseJsonResponse({
        response: trackedResponse,
        request,
        responseSchema,
        validateResponse,
        throwHttpErrors,
      })) as T;
      break;
  }

  return runAfterParseResponseHooks(
    data,
    response,
    request,
    afterParseResponseHooks
  );
}

function emitDebug(debug: DebugOption | undefined, event: DebugEvent): void {
  if (!debug) return;
  if (debug === true) {
    console.debug('[valifetch]', event);
  } else {
    debug(event);
  }
}

function concatArrays<T>(first?: T[], second?: T[]): T[] | undefined {
  if (!first && !second) return undefined;
  if (!first) return second;
  if (!second) return first;
  return first.concat(second);
}

// Per-instance dedupe caches, keyed by the instance's resolved options object
// (stable per instance) so two instances never share in-flight requests.
const dedupeCaches = new WeakMap<
  ValifetchInstanceOptions,
  Map<string, Promise<unknown>>
>();

function getDedupeCache(
  instanceOptions: ValifetchInstanceOptions
): Map<string, Promise<unknown>> {
  let cache = dedupeCaches.get(instanceOptions);
  if (!cache) {
    cache = new Map();
    dedupeCaches.set(instanceOptions, cache);
  }
  return cache;
}

/**
 * Build the dedupe key from the method and the fully-resolved URL.
 * Returns `undefined` when the URL cannot be built (missing path param, invalid
 * URL) so the call skips deduplication and `buildRequest` reports the real error.
 */
function resolveDedupeKey(
  url: string,
  method: HttpMethod,
  options: RequestOptions,
  instanceOptions: ValifetchInstanceOptions
): string | undefined {
  try {
    const resolved = buildUrl({
      prefixUrl: options.prefixUrl ?? instanceOptions.prefixUrl,
      path: url,
      params: options.params,
      searchParams: mergeSearchParams(
        instanceOptions.searchParams,
        options.searchParams
      ),
    });
    return `${method}:${resolved.toString()}`;
  } catch {
    return undefined;
  }
}

function executeRequest<T>(
  url: string,
  method: HttpMethod,
  options: RequestOptions,
  instanceOptions: ValifetchInstanceOptions
): CancellablePromise<T> {
  const cancelController = new AbortController();
  const mergedOptions: RequestOptions = {
    ...options,
    signal: options.signal
      ? AbortSignal.any([options.signal, cancelController.signal])
      : cancelController.signal,
  };

  const dedupe = options.dedupe ?? instanceOptions.dedupe;
  const key = dedupe
    ? resolveDedupeKey(url, method, options, instanceOptions)
    : undefined;
  const cache = key === undefined ? undefined : getDedupeCache(instanceOptions);

  if (cache) {
    const cached = cache.get(key as string) as
      | CancellablePromise<T>
      | undefined;
    if (cached) return cached;
  }

  const promise = executeRequestCore<T>(
    url,
    method,
    mergedOptions,
    instanceOptions
  ) as CancellablePromise<T>;
  promise.cancel = () => cancelController.abort();

  if (cache) {
    const cacheKey = key as string;
    cache.set(cacheKey, promise);
    // `.finally()` returns a NEW promise that re-rejects; leaving it unhandled
    // surfaces as an unhandled rejection even when the caller catches. Attaching
    // the cleanup as both handlers settles this branch of the chain instead.
    const cleanup = (): void => {
      cache.delete(cacheKey);
    };
    void promise.then(cleanup, cleanup);
  }

  return promise;
}

async function executeRequestCore<T>(
  url: string,
  method: HttpMethod,
  options: RequestOptions,
  instanceOptions: ValifetchInstanceOptions
): Promise<T> {
  try {
    return await runRequest<T>(url, method, options, instanceOptions);
  } catch (error) {
    if (error instanceof ValifetchError) {
      // Hooks are read straight from the raw options because buildRequest may
      // throw before normalized options exist.
      const hooks = concatArrays(
        instanceOptions.hooks?.beforeError,
        options.hooks?.beforeError
      );
      throw await runBeforeErrorHooks(error, hooks);
    }
    throw error;
  }
}

async function runRequest<T>(
  url: string,
  method: HttpMethod,
  options: RequestOptions,
  instanceOptions: ValifetchInstanceOptions
): Promise<T> {
  const debug = options.debug ?? instanceOptions.debug;

  const {
    request: initialRequest,
    normalizedOptions,
    responseSchema,
    validateResponse,
    throwHttpErrors,
  } = await buildRequest(url, method, options, instanceOptions);

  const hookResult = await runBeforeRequestHooks(
    initialRequest,
    normalizedOptions,
    normalizedOptions.hooks?.beforeRequest
  );

  if (hookResult instanceof Response) {
    emitDebug(debug, { type: 'request', request: initialRequest });
    emitDebug(debug, {
      type: 'response',
      request: initialRequest,
      response: hookResult,
      attempt: 1,
    });
    // A hook-provided response still runs through afterResponse, so mocks and
    // interceptors see the same pipeline as a real fetch.
    const hookResponse = await runAfterResponseHooks(
      initialRequest,
      normalizedOptions,
      hookResult,
      normalizedOptions.hooks?.afterResponse
    );

    return handleResponse<T>(
      hookResponse,
      initialRequest,
      normalizedOptions,
      responseSchema,
      validateResponse,
      throwHttpErrors,
      normalizedOptions.hooks?.afterParseResponse
    );
  }

  let request = hookResult;
  const retryOptions = normalizeRetryOptions(
    options.retry !== undefined ? options.retry : instanceOptions.retry
  );

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timeoutController: AbortController | undefined;

  // options.signal is always an AbortSignal (set by executeRequest via the cancel controller)
  const baseSignal = options.signal as AbortSignal;

  const setupTimeout = (): AbortSignal => {
    const timeout = options.timeout ?? instanceOptions.timeout;
    if (!timeout) return baseSignal;

    timeoutController = new AbortController();

    // An already-aborted caller signal never fires 'abort', which would leave the
    // timeout controller (the signal fetch actually receives) permanently open.
    if (baseSignal.aborted) {
      timeoutController.abort(baseSignal.reason);
    } else {
      baseSignal.addEventListener('abort', () => {
        timeoutController?.abort(baseSignal.reason);
      });
    }

    timeoutId = setTimeout(() => {
      timeoutController?.abort(new TimeoutAbortError());
    }, timeout);

    return timeoutController.signal;
  };

  const clearTimeoutIfSet = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  let lastError: Error | undefined;
  let attemptCount = 0;
  let lastRequestSent: Request = request;
  const maxAttempts = retryOptions === false ? 1 : retryOptions.limit + 1;

  // Sending the template request marks it used, so a later `.clone()` (or a
  // `new Request(request, ...)` inside a beforeRetry hook) would throw. Guard by
  // sending a clone instead — but only when a retry is actually reachable for
  // this method, so the non-retryable hot path (e.g. POST) keeps sending the
  // template directly. `shouldRetryNetworkError` at attempt 0 answers exactly
  // "could this method ever be retried", covering both limit and method checks.
  const mayRetry =
    retryOptions !== false && shouldRetryNetworkError(method, 0, retryOptions);

  while (attemptCount < maxAttempts) {
    const requestToSend =
      request.body !== null && mayRetry ? request.clone() : request;
    lastRequestSent = requestToSend;

    let response: Response;

    // Only `fetch` belongs inside the try: hook exceptions must propagate to the
    // caller untouched rather than being misread as network failures.
    try {
      const signal = setupTimeout();
      emitDebug(debug, { type: 'request', request: requestToSend });
      response = await fetch(requestToSend, { signal });
      clearTimeoutIfSet();
    } catch (error) {
      clearTimeoutIfSet();

      if (error instanceof Error) {
        if (error.name === 'AbortError' || timeoutController?.signal.aborted) {
          const isTimeout =
            error instanceof TimeoutAbortError ||
            timeoutController?.signal.reason instanceof TimeoutAbortError;

          if (!isTimeout) {
            emitDebug(debug, { type: 'cancel', request: lastRequestSent });
          }

          throw new ValifetchError({
            message: isTimeout ? 'Request timed out' : 'Request was aborted',
            code: isTimeout ? 'TIMEOUT_ERROR' : 'ABORT_ERROR',
            request,
            cause: error,
          });
        }

        lastError = error;

        const networkError = (): ValifetchError =>
          new ValifetchError({
            message: error.message || 'Network request failed',
            code: 'NETWORK_ERROR',
            request,
            cause: error,
          });

        if (
          retryOptions === false ||
          attemptCount >= maxAttempts - 1 ||
          !shouldRetryNetworkError(method, attemptCount, retryOptions)
        ) {
          throw networkError();
        }

        const outcome = await runBeforeRetryHooks(
          {
            request,
            options: normalizedOptions,
            retryCount: attemptCount + 1,
            reason: 'network',
            error,
          },
          normalizedOptions.hooks?.beforeRetry
        );

        if (outcome === stop) {
          throw networkError();
        }

        request = outcome;
        attemptCount++;
        const networkDelay = calculateRetryDelay(
          attemptCount - 1,
          retryOptions
        );
        emitDebug(debug, {
          type: 'retry',
          request: requestToSend,
          attempt: attemptCount,
          delay: networkDelay,
          reason: 'network',
        });
        await sleep(networkDelay);
        continue;
      }

      throw error;
    }

    emitDebug(debug, {
      type: 'response',
      request: requestToSend,
      response,
      attempt: attemptCount + 1,
    });

    const shouldRetryStatus =
      retryOptions !== false &&
      attemptCount < maxAttempts - 1 &&
      shouldRetry(method, response.status, attemptCount, retryOptions);

    if (shouldRetryStatus) {
      const outcome = await runBeforeRetryHooks(
        {
          request,
          options: normalizedOptions,
          retryCount: attemptCount + 1,
          reason: 'status',
          response,
        },
        normalizedOptions.hooks?.beforeRetry
      );

      // `stop` aborts the retry loop; the response falls through to the
      // normal handling path as if retries were exhausted.
      if (outcome !== stop) {
        request = outcome;
        attemptCount++;
        const delay =
          getRetryAfterDelay(response) ??
          calculateRetryDelay(attemptCount - 1, retryOptions);
        emitDebug(debug, {
          type: 'retry',
          request: requestToSend,
          attempt: attemptCount,
          delay,
          reason: 'status',
        });
        await sleep(delay);
        continue;
      }
    }

    const finalResponse = await runAfterResponseHooks(
      request,
      normalizedOptions,
      response,
      normalizedOptions.hooks?.afterResponse
    );

    return await handleResponse<T>(
      finalResponse,
      request,
      normalizedOptions,
      responseSchema,
      validateResponse,
      throwHttpErrors,
      normalizedOptions.hooks?.afterParseResponse
    );
  }

  // Defensive: should never reach here as the loop always exits via return or throw
  // Kept as safety net in case of unexpected edge cases
  /* v8 ignore next 5 */
  throw new ValifetchError({
    message: lastError?.message || 'Request failed after retries',
    code: 'NETWORK_ERROR',
    request,
    ...(lastError && { cause: lastError }),
  });
}

type Instance = ValifetchInstance & {
  opts: ValifetchInstanceOptions;
  parent: Instance | undefined;
  merged: ValifetchInstanceOptions | undefined;
};

// Abort every input that exposes a `.cancel()` method; ignore plain promises
// and non-cancellable values so mixed arrays are safe.
function cancelAll(requests: readonly unknown[]): void {
  for (const req of requests) {
    (req as { cancel?: () => void } | null | undefined)?.cancel?.();
  }
}

const getInstanceOptions = (instance: Instance): ValifetchInstanceOptions =>
  instance.merged ??
  (instance.parent
    ? (instance.merged = mergeOptions(
        getInstanceOptions(instance.parent),
        instance.opts
      ))
    : instance.opts);

const proto = {
  get(this: Instance, url: string, requestOptions?: RequestOptions) {
    return executeRequest(
      url,
      'GET',
      requestOptions ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  post(this: Instance, url: string, requestOptions?: RequestOptions) {
    return executeRequest(
      url,
      'POST',
      requestOptions ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  put(this: Instance, url: string, requestOptions?: RequestOptions) {
    return executeRequest(
      url,
      'PUT',
      requestOptions ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  patch(this: Instance, url: string, requestOptions?: RequestOptions) {
    return executeRequest(
      url,
      'PATCH',
      requestOptions ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  delete(this: Instance, url: string, requestOptions?: RequestOptions) {
    return executeRequest(
      url,
      'DELETE',
      requestOptions ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  head(this: Instance, url: string, requestOptions?: RequestOptions) {
    const req = executeRequest(
      url,
      'HEAD',
      // HEAD never exposes a body, so the response is taken raw and dropped.
      { ...requestOptions, responseType: 'raw' },
      getInstanceOptions(this)
    );
    const p = req.then(() => undefined) as CancellablePromise<void>;
    p.cancel = req.cancel;
    return p;
  },
  options(this: Instance, url: string, requestOptions?: RequestOptions) {
    return executeRequest(
      url,
      'OPTIONS',
      requestOptions ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  all(requests: readonly unknown[]) {
    const promise = Promise.all(requests) as CancellablePromise<unknown[]>;
    promise.cancel = () => cancelAll(requests);
    return promise;
  },
  allSettled(requests: readonly unknown[]) {
    const promise = Promise.allSettled(requests) as CancellablePromise<
      PromiseSettledResult<unknown>[]
    >;
    promise.cancel = () => cancelAll(requests);
    return promise;
  },
  create(newOptions?: ValifetchInstanceOptions) {
    // A fresh object per call (not the frozen EMPTY singleton) so each
    // no-arg create() gets its own dedupe-cache identity in the WeakMap.
    return createInstance(newOptions ?? {});
  },
  extend(
    this: Instance,
    options:
      | ValifetchInstanceOptions
      | ((prev: ValifetchInstanceOptions) => ValifetchInstanceOptions)
  ) {
    return typeof options === 'function'
      ? createInstance(options(getInstanceOptions(this)))
      : createInstanceWithParent(options, this);
  },
  callable(this: Instance) {
    return callable(this);
  },
} as unknown as Instance;

function createInstance(options: ValifetchInstanceOptions): ValifetchInstance {
  const inst = Object.create(proto) as Instance;
  inst.opts = options;
  return inst;
}

function createInstanceWithParent(
  options: ValifetchInstanceOptions,
  parent: Instance
): ValifetchInstance {
  const inst = Object.create(proto) as Instance;
  inst.opts = options;
  inst.parent = parent;
  return inst;
}

// Callable wrapper for ky-style syntax: api('/users') instead of api.get('/users')
function callable(instance: ValifetchInstance): CallableInstance {
  const inst = instance as Instance;

  const fn = function <TData = unknown>(
    url: string,
    requestOptions?: RequestOptions
  ): CancellablePromise<TData> {
    return executeRequest<TData>(
      url,
      requestOptions?.method ?? 'GET',
      requestOptions ?? EMPTY,
      getInstanceOptions(inst)
    );
  };

  fn.get = inst.get.bind(inst);
  fn.post = inst.post.bind(inst);
  fn.put = inst.put.bind(inst);
  fn.patch = inst.patch.bind(inst);
  fn.delete = inst.delete.bind(inst);
  fn.head = inst.head.bind(inst);
  fn.options = inst.options.bind(inst);
  fn.all = inst.all.bind(inst);
  fn.allSettled = inst.allSettled.bind(inst);

  fn.create = (options?: ValifetchInstanceOptions) =>
    callable(inst.create(options));
  fn.extend = (
    options:
      | ValifetchInstanceOptions
      | ((parent: ValifetchInstanceOptions) => ValifetchInstanceOptions)
  ) => callable(inst.extend(options));

  // Checked assertion (no `unknown` hop): TS still verifies the shape overlaps
  // `CallableInstance`, it just cannot relate the two generic parameter lists.
  return fn as CallableInstance;
}

function mergeHooks(parent?: Hooks, child?: Hooks): Hooks | undefined {
  if (!parent && !child) return undefined;
  if (!parent) return child;
  if (!child) return parent;

  // Loosely typed accumulator: TS cannot relate `Hooks[K]` element types across
  // a generic key iteration.
  const merged: Record<string, unknown[] | undefined> = {};

  for (const key of HOOK_KEYS) {
    merged[key] = concatArrays(
      parent[key] as unknown[] | undefined,
      child[key] as unknown[] | undefined
    );
  }

  return merged as Hooks;
}

function copyHeaders(
  source: HeadersInit,
  target: Record<string, string>
): void {
  // Header names are case-insensitive: lowercase every key so a parent's
  // `Content-Type` and a child's `content-type` collapse to a single entry.
  if (source instanceof Headers) {
    source.forEach((value, key) => {
      target[key.toLowerCase()] = value;
    });
  } else if (Array.isArray(source)) {
    for (const [key, value] of source) target[key.toLowerCase()] = value;
  } else {
    for (const [key, value] of Object.entries(source)) {
      target[key.toLowerCase()] = value;
    }
  }
}

function mergeHeaders(
  parent?: HeadersInit,
  child?: HeadersInit
): Record<string, string> | undefined {
  if (!parent && !child) return undefined;

  const result: Record<string, string> = {};
  if (parent) copyHeaders(parent, result);
  if (child) copyHeaders(child, result);

  return result;
}

function mergeOptions(
  parent: ValifetchInstanceOptions,
  child: ValifetchInstanceOptions
): ValifetchInstanceOptions {
  // Every defined child key wins generically, so a newly added option never has
  // to be re-listed here. `hooks`, `headers` and `searchParams` are the
  // exceptions: they combine with the parent instead of replacing it.
  const result = { ...parent } as Record<string, unknown>;

  for (const key of Object.keys(child) as (keyof ValifetchInstanceOptions)[]) {
    if (key === 'hooks' || key === 'headers' || key === 'searchParams')
      continue;
    const value = child[key];
    if (value !== undefined) result[key] = value;
  }

  const mergedHooks = mergeHooks(parent.hooks, child.hooks);
  const mergedHeaders = mergeHeaders(parent.headers, child.headers);
  const mergedSearchParams = mergeSearchParams(
    parent.searchParams,
    child.searchParams
  );
  if (mergedHooks) result.hooks = mergedHooks;
  if (mergedHeaders) result.headers = mergedHeaders;
  if (mergedSearchParams) result.searchParams = mergedSearchParams;

  return result as ValifetchInstanceOptions;
}

/**
 * The default valifetch instance.
 * Use `.get()`, `.post()`, etc. directly, or call `.create()` / `.extend()` to make a configured instance.
 *
 * @example
 * ```ts
 * const data = await valifetch.get<User>('https://api.example.com/users/1');
 * ```
 */
export const valifetch: ValifetchInstance = createInstance({});

/** Default export alias — enables `import valifetch from 'valifetch'` syntax. */
const _default: ValifetchInstance = valifetch;

export { _default as default };
