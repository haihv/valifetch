import type {
  AfterParseResponseHook,
  AfterResponseHook,
  BeforeRequestHook,
  NormalizedOptions,
} from '../types';

/**
 * Run all `beforeRequest` hooks in order.
 * If a hook returns a `Response`, the chain short-circuits and that response is returned directly
 * (bypassing the actual fetch call). If a hook returns a new `Request`, it replaces the current one.
 * @param request - The initial request
 * @param options - Normalized request options
 * @param hooks - Array of hooks to run
 * @returns The (possibly modified) `Request`, or an early `Response` from a hook
 */
export async function runBeforeRequestHooks(
  request: Request,
  options: NormalizedOptions,
  hooks?: BeforeRequestHook[]
): Promise<Request | Response> {
  if (!hooks || hooks.length === 0) {
    return request;
  }

  let currentRequest = request;

  for (const hook of hooks) {
    const result = await hook(currentRequest, options);

    if (result instanceof Response) {
      return result;
    }

    if (result instanceof Request) {
      currentRequest = result;
    }
  }

  return currentRequest;
}

/**
 * Run all `afterResponse` hooks in order.
 * If a hook returns a new `Response`, it replaces the current one for subsequent hooks.
 * @param request - The original request
 * @param options - Normalized request options
 * @param response - The response received from fetch
 * @param hooks - Array of hooks to run
 * @returns The (possibly modified) `Response`
 */
export async function runAfterResponseHooks(
  request: Request,
  options: NormalizedOptions,
  response: Response,
  hooks?: AfterResponseHook[]
): Promise<Response> {
  if (!hooks || hooks.length === 0) {
    return response;
  }

  let currentResponse = response;

  for (const hook of hooks) {
    const result = await hook(request, options, currentResponse);

    if (result instanceof Response) {
      currentResponse = result;
    }
  }

  return currentResponse;
}

/**
 * Run all `afterParseResponse` hooks in order.
 * Each hook receives the current data and can return a transformed value.
 * @param data - The parsed response data
 * @param response - The raw response
 * @param request - The original request
 * @param hooks - Array of hooks to run
 * @returns The (possibly transformed) data
 */
export async function runAfterParseResponseHooks<T>(
  data: T,
  response: Response,
  request: Request,
  hooks?: AfterParseResponseHook[]
): Promise<T> {
  if (!hooks || hooks.length === 0) {
    return data;
  }

  let currentData = data;

  for (const hook of hooks) {
    currentData = (await hook(currentData, response, request)) as T;
  }

  return currentData;
}
