import type {
  BeforeRequestHook,
  AfterResponseHook,
  AfterParseResponseHook,
  NormalizedOptions,
} from '../types';

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
