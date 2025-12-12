import type { BeforeRequestHook, AfterResponseHook, NormalizedOptions } from '../types';

/**
 * Run all beforeRequest hooks in sequence
 * Returns modified Request or Response (to skip fetch)
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
      // Hook returned a Response, skip remaining hooks and fetch
      return result;
    }

    if (result instanceof Request) {
      // Hook returned a modified Request
      currentRequest = result;
    }
    // If result is void/undefined, continue with current request
  }

  return currentRequest;
}

/**
 * Run all afterResponse hooks in sequence
 * Returns modified Response
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
      // Hook returned a modified Response
      currentResponse = result;
    }
    // If result is void/undefined, continue with current response
  }

  return currentResponse;
}
