import type { GenericSchema } from 'valibot';
import type {
  HttpMethod,
  ValifetchInstanceOptions,
  ValifetchInstance,
  ResponseType,
  RetryOptions,
  SearchParamsInit,
  Hooks,
  AfterParseResponseHook,
} from '../types';
import { ValifetchError } from '../errors/ValifetchError';
import { buildRequest } from './request';
import { parseJsonResponse, checkResponseStatus } from './response';
import {
  runBeforeRequestHooks,
  runAfterResponseHooks,
  runAfterParseResponseHooks,
} from './hooks';
import {
  normalizeRetryOptions,
  shouldRetry,
  calculateRetryDelay,
  sleep,
} from './retry';

type InternalOptions = {
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
};

function createInstance(
  instanceOptions: ValifetchInstanceOptions = {}
): ValifetchInstance {
  async function executeRequest<T>(
    url: string,
    method: HttpMethod,
    options: InternalOptions = {}
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
    const maxAttempts =
      retryOptions === false ? 1 : (retryOptions.limit ?? 2) + 1;

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
          const delay = calculateRetryDelay(attemptCount - 1, retryOptions);
          await sleep(delay);
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
          if (
            error.name === 'AbortError' ||
            timeoutController?.signal.aborted
          ) {
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
          const delay = calculateRetryDelay(attemptCount - 1, retryOptions);
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new ValifetchError({
      message: lastError?.message || 'Request failed after retries',
      code: 'NETWORK_ERROR',
      request,
      ...(lastError && { cause: lastError }),
    });
  }

  async function handleResponse<T>(
    response: Response,
    request: Request,
    options: InternalOptions,
    responseSchema: GenericSchema | undefined,
    validateResponse: boolean,
    throwHttpErrors: boolean,
    afterParseResponseHooks?: AfterParseResponseHook[]
  ): Promise<T> {
    const responseType = options.responseType ?? 'json';
    checkResponseStatus(response, request, throwHttpErrors);

    let data: T;

    switch (responseType) {
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

  // Build the instance object
  const instance: ValifetchInstance = {
    get: (url, options) =>
      executeRequest(url, 'GET', (options ?? {}) as InternalOptions),

    post: (url, options) =>
      executeRequest(url, 'POST', (options ?? {}) as InternalOptions),

    put: (url, options) =>
      executeRequest(url, 'PUT', (options ?? {}) as InternalOptions),

    patch: (url, options) =>
      executeRequest(url, 'PATCH', (options ?? {}) as InternalOptions),

    delete: (url, options) =>
      executeRequest(url, 'DELETE', (options ?? {}) as InternalOptions),

    head: (url, options) =>
      executeRequest(url, 'HEAD', {
        ...(options ?? {}),
        responseType: 'raw',
      } as InternalOptions).then(() => undefined),

    options: (url, options) =>
      executeRequest(url, 'OPTIONS', (options ?? {}) as InternalOptions),

    create: (opts) => createInstance(opts),

    extend: (opts) => {
      const newOptions =
        typeof opts === 'function'
          ? opts(instanceOptions)
          : mergeInstanceOptions(instanceOptions, opts);
      return createInstance(newOptions);
    },
  };

  return instance;
}

function mergeInstanceOptions(
  parent: ValifetchInstanceOptions,
  child: ValifetchInstanceOptions
): ValifetchInstanceOptions {
  return {
    ...parent,
    ...child,
    headers: mergeHeaders(parent.headers, child.headers),
    hooks: {
      beforeRequest: [
        ...(parent.hooks?.beforeRequest ?? []),
        ...(child.hooks?.beforeRequest ?? []),
      ],
      afterResponse: [
        ...(parent.hooks?.afterResponse ?? []),
        ...(child.hooks?.afterResponse ?? []),
      ],
      afterParseResponse: [
        ...(parent.hooks?.afterParseResponse ?? []),
        ...(child.hooks?.afterParseResponse ?? []),
      ],
    },
  };
}

function mergeHeaders(parent?: HeadersInit, child?: HeadersInit): Headers {
  const headers = new Headers();

  if (parent) {
    const source = new Headers(parent);
    source.forEach((value, key) => headers.set(key, value));
  }

  if (child) {
    const source = new Headers(child);
    source.forEach((value, key) => headers.set(key, value));
  }

  return headers;
}

export const valifetch = createInstance();
