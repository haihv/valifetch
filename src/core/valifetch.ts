import type { GenericSchema } from 'valibot';
import type {
  HttpMethod,
  ValifetchInstanceOptions,
  ValifetchInstance,
  ResponseType,
} from '../types';
import { ValifetchError } from '../errors/ValifetchError';
import { buildRequest } from './request';
import { parseJsonResponse, checkResponseStatus } from './response';
import { runBeforeRequestHooks, runAfterResponseHooks } from './hooks';
import { normalizeRetryOptions, shouldRetry, calculateRetryDelay, sleep } from './retry';

/**
 * Internal options type for request execution
 */
type InternalOptions = {
  prefixUrl?: string;
  timeout?: number;
  searchParams?: unknown;
  validateResponse?: boolean;
  validateRequest?: boolean;
  throwHttpErrors?: boolean;
  retry?: unknown;
  hooks?: unknown;
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

/**
 * Create a valifetch instance with optional default options
 */
function createInstance(instanceOptions: ValifetchInstanceOptions = {}): ValifetchInstance {
  /**
   * Execute a request and return parsed response
   */
  async function executeRequest<T>(
    url: string,
    method: HttpMethod,
    options: InternalOptions = {}
  ): Promise<T> {
    // Build the request
    const {
      request: initialRequest,
      normalizedOptions,
      responseSchema,
      validateResponse,
      throwHttpErrors,
    } = await buildRequest(url, method, options as any, instanceOptions);

    // Run beforeRequest hooks
    const hookResult = await runBeforeRequestHooks(
      initialRequest,
      normalizedOptions,
      normalizedOptions.hooks?.beforeRequest
    );

    // If hook returned a Response, process it directly
    if (hookResult instanceof Response) {
      return handleResponse<T>(hookResult, initialRequest, options, responseSchema, validateResponse, throwHttpErrors);
    }

    const request = hookResult;

    // Normalize retry options
    const retryOptions = normalizeRetryOptions(
      options.retry !== undefined ? options.retry as any : instanceOptions.retry
    );

    // Setup timeout if specified
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let timeoutController: AbortController | undefined;

    const setupTimeout = (): AbortSignal | null | undefined => {
      const timeout = options.timeout ?? instanceOptions.timeout;
      if (!timeout) return options.signal;

      timeoutController = new AbortController();

      // Combine with existing signal if provided
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

    // Execute fetch with retry logic
    let lastError: Error | undefined;
    let attemptCount = 0;
    const maxAttempts = retryOptions === false ? 1 : (retryOptions.limit ?? 2) + 1;

    while (attemptCount < maxAttempts) {
      try {
        const signal = setupTimeout();

        // Clone request for retry (body can only be consumed once)
        const requestToSend = attemptCount > 0 ? request.clone() : request;

        const fetchInit: RequestInit = {};
        if (signal !== undefined) {
          fetchInit.signal = signal;
        }

        const response = await fetch(requestToSend, fetchInit);

        clearTimeoutIfSet();

        // Check if we should retry based on status code
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

        // Run afterResponse hooks
        const finalResponse = await runAfterResponseHooks(
          request,
          normalizedOptions,
          response,
          normalizedOptions.hooks?.afterResponse
        );

        // Parse and return response based on responseType
        return handleResponse<T>(finalResponse, request, options, responseSchema, validateResponse, throwHttpErrors);
      } catch (error) {
        clearTimeoutIfSet();

        // Handle abort/timeout errors
        if (error instanceof Error) {
          if (error.name === 'AbortError' || timeoutController?.signal.aborted) {
            const isTimeout = error.message === 'Request timed out' ||
              (timeoutController?.signal.reason as Error)?.message === 'Request timed out';

            throw new ValifetchError({
              message: isTimeout ? 'Request timed out' : 'Request was aborted',
              code: isTimeout ? 'TIMEOUT_ERROR' : 'ABORT_ERROR',
              request,
              cause: error,
            });
          }

          lastError = error;

          // Don't retry on non-retryable errors
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

    // Should not reach here, but just in case
    throw new ValifetchError({
      message: lastError?.message || 'Request failed after retries',
      code: 'NETWORK_ERROR',
      request,
      ...(lastError && { cause: lastError }),
    });
  }

  /**
   * Handle response based on responseType option
   */
  async function handleResponse<T>(
    response: Response,
    request: Request,
    options: InternalOptions,
    responseSchema: GenericSchema | undefined,
    validateResponse: boolean,
    throwHttpErrors: boolean
  ): Promise<T> {
    const responseType = options.responseType ?? 'json';

    // Check status first
    checkResponseStatus(response, request, throwHttpErrors);

    switch (responseType) {
      case 'raw':
        return response as T;

      case 'text':
        return await response.text() as T;

      case 'blob':
        return await response.blob() as T;

      case 'arrayBuffer':
        return await response.arrayBuffer() as T;

      case 'formData':
        return await response.formData() as T;

      case 'json':
      default:
        return await parseJsonResponse({
          response,
          request,
          responseSchema,
          validateResponse,
          throwHttpErrors,
        }) as T;
    }
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
      executeRequest(url, 'HEAD', { ...(options ?? {}), responseType: 'raw' } as InternalOptions).then(() => undefined),

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

/**
 * Merge instance options for extend()
 */
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
    },
  };
}

/**
 * Merge headers from parent and child
 */
function mergeHeaders(
  parent?: HeadersInit,
  child?: HeadersInit
): Headers {
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

// Create and export the default instance
export const valifetch = createInstance();
