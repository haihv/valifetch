import { ValifetchError } from '../errors/ValifetchError';
import type {
  AfterParseResponseHook,
  AfterResponseHook,
  BeforeErrorHook,
  BeforeRequestHook,
  BeforeRetryHook,
  BeforeRetryState,
  NormalizedOptions,
} from '../types';
import { stop } from './stop';

export { stop };

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
 * If a hook returns a `Response`, the chain short-circuits immediately and that response is
 * returned (remaining hooks are skipped). This enables patterns like 401 token-refresh + retry
 * without triggering an infinite loop — hooks only run once per request attempt.
 * Hooks that return `void` or `undefined` leave the response unchanged.
 * @param request - The original request
 * @param options - Normalized request options
 * @param response - The response received from fetch
 * @param hooks - Array of hooks to run
 * @returns The (possibly replaced) `Response`
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

  for (const hook of hooks) {
    const result = await hook(request, options, response);

    if (result instanceof Response) {
      return result;
    }
  }

  return response;
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

/**
 * Run all `beforeRetry` hooks in order.
 * If a hook returns `stop`, the chain short-circuits and `stop` is returned
 * immediately (remaining hooks are skipped). If a hook returns a `Request`, it
 * replaces the request seen by subsequent hooks and becomes the return value.
 * @param state - The retry state passed to each hook
 * @param hooks - Array of hooks to run
 * @returns The (possibly replaced) `Request`, or `stop` to abort retrying
 */
export async function runBeforeRetryHooks(
  state: BeforeRetryState,
  hooks?: BeforeRetryHook[]
): Promise<Request | typeof stop> {
  if (!hooks || hooks.length === 0) {
    return state.request;
  }

  let currentState = state;

  for (const hook of hooks) {
    const result = await hook(currentState);

    if (result === stop) {
      return stop;
    }

    if (result instanceof Request) {
      currentState = { ...currentState, request: result };
    }
  }

  return currentState.request;
}

/**
 * Run all `beforeError` hooks in order.
 * A hook that returns a `ValifetchError` replaces the error passed to the next
 * hook and finally returned to the caller. Any other return value (including a
 * hook that forgets to return) is ignored so the pipeline never throws a
 * non-error value.
 * @param error - The error about to be thrown
 * @param hooks - Array of hooks to run
 * @returns The (possibly replaced) error to throw
 */
export async function runBeforeErrorHooks(
  error: ValifetchError,
  hooks?: BeforeErrorHook[]
): Promise<ValifetchError> {
  if (!hooks || hooks.length === 0) {
    return error;
  }

  let currentError = error;

  for (const hook of hooks) {
    const next = await hook(currentError);
    if (next instanceof ValifetchError) {
      currentError = next;
    }
  }

  return currentError;
}
