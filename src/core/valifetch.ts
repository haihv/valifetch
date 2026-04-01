import type { GenericSchema } from 'valibot';
import { ValifetchError } from '../errors/ValifetchError';
import type {
  AfterParseResponseHook,
  Hooks,
  HttpMethod,
  ResponseType,
  RetryOptions,
  SearchParamsInit,
  ValifetchInstance,
  ValifetchInstanceOptions,
} from '../types';
import {
  runAfterParseResponseHooks,
  runAfterResponseHooks,
  runBeforeRequestHooks,
} from './hooks';
import { buildRequest } from './request';
import { checkResponseStatus, parseJsonResponse } from './response';
import {
  calculateRetryDelay,
  normalizeRetryOptions,
  shouldRetry,
  sleep,
} from './retry';

type RequestOptions = {
  prefixUrl?: string;
  timeout?: number;
  searchParams?: SearchParamsInit;
  validateResponse?: boolean;
  validateRequest?: boolean;
  throwHttpErrors?: boolean;
  retry?: RetryOptions | number | false;
  hooks?: Hooks;
  headers?: HeadersInit;
  signal?: AbortSignal | null;
  responseSchema?: GenericSchema;
  bodySchema?: GenericSchema;
  paramsSchema?: GenericSchema;
  searchSchema?: GenericSchema;
  json?: unknown;
  form?: FormData | URLSearchParams | Record<string, string>;
  params?: Record<string, string | number>;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  integrity?: string;
  keepalive?: boolean;
  mode?: RequestMode;
  responseType?: ResponseType;
  method?: HttpMethod;
  dedupe?: boolean;
};

const EMPTY = {} as RequestOptions;

async function handleResponse<T>(
  response: Response,
  request: Request,
  options: RequestOptions,
  responseSchema: GenericSchema | undefined,
  validateResponse: boolean,
  throwHttpErrors: boolean,
  afterParseResponseHooks?: AfterParseResponseHook[]
): Promise<T> {
  const responseType = options.responseType ?? 'json';
  checkResponseStatus(response, request, throwHttpErrors);

  let data: T;

  switch (responseType) {
    case 'stream':
      return response.body as T;
    case 'raw':
      return response as T;
    case 'text':
      data = (await response.text()) as T;
      break;
    case 'blob':
      data = (await response.blob()) as T;
      break;
    case 'arrayBuffer':
      data = (await response.arrayBuffer()) as T;
      break;
    case 'formData':
      data = (await response.formData()) as T;
      break;
    case 'json':
    default:
      data = (await parseJsonResponse({
        response,
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

const dedupeCache = new Map<string, Promise<unknown>>();

function executeRequest<T>(
  url: string,
  method: HttpMethod,
  options: RequestOptions,
  instanceOptions: ValifetchInstanceOptions
): Promise<T> {
  const dedupe = options.dedupe ?? instanceOptions.dedupe;
  const key = `${method}:${url}`;

  if (dedupe) {
    const cached = dedupeCache.get(key) as Promise<T> | undefined;
    if (cached) return cached;
  }

  const promise = executeRequestCore<T>(url, method, options, instanceOptions);

  if (dedupe) {
    dedupeCache.set(key, promise);
    void promise.finally(() => dedupeCache.delete(key));
  }

  return promise;
}

async function executeRequestCore<T>(
  url: string,
  method: HttpMethod,
  options: RequestOptions,
  instanceOptions: ValifetchInstanceOptions
): Promise<T> {
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
    return handleResponse<T>(
      hookResult,
      initialRequest,
      options,
      responseSchema,
      validateResponse,
      throwHttpErrors,
      normalizedOptions.hooks?.afterParseResponse
    );
  }

  const request = hookResult;
  const retryOptions = normalizeRetryOptions(
    options.retry !== undefined ? options.retry : instanceOptions.retry
  );

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timeoutController: AbortController | undefined;

  const setupTimeout = (): AbortSignal | null | undefined => {
    const timeout = options.timeout ?? instanceOptions.timeout;
    if (!timeout) return options.signal;

    timeoutController = new AbortController();

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        timeoutController?.abort((options.signal as AbortSignal).reason);
      });
    }

    timeoutId = setTimeout(() => {
      timeoutController?.abort(new Error('Request timed out'));
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
  const maxAttempts = retryOptions === false ? 1 : retryOptions.limit + 1;

  while (attemptCount < maxAttempts) {
    try {
      const signal = setupTimeout();
      const requestToSend = attemptCount > 0 ? request.clone() : request;

      const fetchInit: RequestInit = {};
      if (signal !== undefined) {
        fetchInit.signal = signal;
      }

      const response = await fetch(requestToSend, fetchInit);
      clearTimeoutIfSet();

      if (
        retryOptions !== false &&
        attemptCount < maxAttempts - 1 &&
        shouldRetry(method, response.status, attemptCount, retryOptions)
      ) {
        attemptCount++;
        await sleep(calculateRetryDelay(attemptCount - 1, retryOptions));
        continue;
      }

      const finalResponse = await runAfterResponseHooks(
        request,
        normalizedOptions,
        response,
        normalizedOptions.hooks?.afterResponse
      );

      return handleResponse<T>(
        finalResponse,
        request,
        options,
        responseSchema,
        validateResponse,
        throwHttpErrors,
        normalizedOptions.hooks?.afterParseResponse
      );
    } catch (error) {
      clearTimeoutIfSet();

      if (error instanceof Error) {
        if (error.name === 'AbortError' || timeoutController?.signal.aborted) {
          const isTimeout =
            error.message === 'Request timed out' ||
            (timeoutController?.signal.reason as Error)?.message ===
              'Request timed out';

          throw new ValifetchError({
            message: isTimeout ? 'Request timed out' : 'Request was aborted',
            code: isTimeout ? 'TIMEOUT_ERROR' : 'ABORT_ERROR',
            request,
            cause: error,
          });
        }

        lastError = error;

        if (retryOptions === false || attemptCount >= maxAttempts - 1) {
          throw new ValifetchError({
            message: error.message || 'Network request failed',
            code: 'NETWORK_ERROR',
            request,
            cause: error,
          });
        }

        attemptCount++;
        await sleep(calculateRetryDelay(attemptCount - 1, retryOptions));
        continue;
      }

      throw error;
    }
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

const getInstanceOptions = (instance: Instance): ValifetchInstanceOptions =>
  instance.merged ??
  (instance.parent
    ? (instance.merged = mergeOptions(
        getInstanceOptions(instance.parent),
        instance.opts
      ))
    : instance.opts);

const proto = {
  get(this: Instance, url: string, options?: RequestOptions) {
    return executeRequest(
      url,
      'GET',
      options ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  post(this: Instance, url: string, options?: RequestOptions) {
    return executeRequest(
      url,
      'POST',
      options ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  put(this: Instance, url: string, options?: RequestOptions) {
    return executeRequest(
      url,
      'PUT',
      options ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  patch(this: Instance, url: string, options?: RequestOptions) {
    return executeRequest(
      url,
      'PATCH',
      options ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  delete(this: Instance, url: string, options?: RequestOptions) {
    return executeRequest(
      url,
      'DELETE',
      options ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  head(this: Instance, url: string, options?: RequestOptions) {
    return executeRequest(
      url,
      'HEAD',
      { ...options, responseType: 'raw' },
      getInstanceOptions(this)
    ).then(() => undefined);
  },
  options(this: Instance, url: string, options?: RequestOptions) {
    return executeRequest(
      url,
      'OPTIONS',
      options ?? EMPTY,
      getInstanceOptions(this)
    );
  },
  create(newOptions?: ValifetchInstanceOptions) {
    return createInstance(newOptions ?? EMPTY);
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
function callable(instance: ValifetchInstance) {
  const inst = instance as Instance;

  const fn = function <TData = unknown>(
    url: string,
    options?: RequestOptions
  ): Promise<TData> {
    return executeRequest<TData>(
      url,
      options?.method ?? 'GET',
      options ?? EMPTY,
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

  fn.create = (options?: ValifetchInstanceOptions) =>
    callable(inst.create(options));
  fn.extend = (
    options:
      | ValifetchInstanceOptions
      | ((parent: ValifetchInstanceOptions) => ValifetchInstanceOptions)
  ) => callable(inst.extend(options));

  return fn;
}

function concatArrays<T>(first?: T[], second?: T[]): T[] | undefined {
  if (!first && !second) return undefined;
  if (!first) return second;
  if (!second) return first;
  return first.concat(second);
}

function mergeHooks(parent?: Hooks, child?: Hooks): Hooks | undefined {
  if (!parent && !child) return undefined;
  if (!parent) return child;
  if (!child) return parent;

  return {
    beforeRequest: concatArrays(parent.beforeRequest, child.beforeRequest),
    afterResponse: concatArrays(parent.afterResponse, child.afterResponse),
    afterParseResponse: concatArrays(
      parent.afterParseResponse,
      child.afterParseResponse
    ),
  };
}

function copyHeaders(
  source: HeadersInit,
  target: Record<string, string>
): void {
  if (source instanceof Headers) {
    source.forEach((value, key) => {
      target[key] = value;
    });
  } else if (Array.isArray(source)) {
    for (const [key, value] of source) target[key] = value;
  } else {
    Object.assign(target, source);
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
  const result: ValifetchInstanceOptions = { ...parent };

  if (child.prefixUrl !== undefined) result.prefixUrl = child.prefixUrl;
  if (child.timeout !== undefined) result.timeout = child.timeout;
  if (child.validateResponse !== undefined)
    result.validateResponse = child.validateResponse;
  if (child.validateRequest !== undefined)
    result.validateRequest = child.validateRequest;
  if (child.throwHttpErrors !== undefined)
    result.throwHttpErrors = child.throwHttpErrors;
  if (child.retry !== undefined) result.retry = child.retry;
  if (child.credentials !== undefined) result.credentials = child.credentials;
  if (child.cache !== undefined) result.cache = child.cache;
  if (child.redirect !== undefined) result.redirect = child.redirect;
  if (child.referrer !== undefined) result.referrer = child.referrer;
  if (child.referrerPolicy !== undefined)
    result.referrerPolicy = child.referrerPolicy;
  if (child.integrity !== undefined) result.integrity = child.integrity;
  if (child.keepalive !== undefined) result.keepalive = child.keepalive;
  if (child.mode !== undefined) result.mode = child.mode;

  const mergedHooks = mergeHooks(parent.hooks, child.hooks);
  const mergedHeaders = mergeHeaders(parent.headers, child.headers);
  if (mergedHooks) result.hooks = mergedHooks;
  if (mergedHeaders) result.headers = mergedHeaders;

  return result;
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
