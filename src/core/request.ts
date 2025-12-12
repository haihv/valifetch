import type { GenericSchema } from 'valibot';
import type {
  HttpMethod,
  ValifetchOptions,
  ValifetchInstanceOptions,
  NormalizedOptions,
} from '../types';
import { buildUrl } from '../url/builder';
import { validate } from '../validation/validate';

/**
 * Merge headers from various sources
 */
function mergeHeaders(
  instanceHeaders?: HeadersInit,
  requestHeaders?: HeadersInit
): Headers {
  const headers = new Headers();

  // Add instance headers first
  if (instanceHeaders) {
    const source = new Headers(instanceHeaders);
    source.forEach((value, key) => headers.set(key, value));
  }

  // Override with request headers
  if (requestHeaders) {
    const source = new Headers(requestHeaders);
    source.forEach((value, key) => headers.set(key, value));
  }

  return headers;
}

/**
 * Deep merge instance options with request options
 */
export function mergeOptions(
  instanceOptions: ValifetchInstanceOptions,
  requestOptions: ValifetchOptions
): ValifetchOptions & { headers: Headers } {
  return {
    ...instanceOptions,
    ...requestOptions,
    headers: mergeHeaders(instanceOptions.headers, requestOptions.headers),
    // Merge hooks
    hooks: {
      beforeRequest: [
        ...(instanceOptions.hooks?.beforeRequest ?? []),
        ...(requestOptions.hooks?.beforeRequest ?? []),
      ],
      afterResponse: [
        ...(instanceOptions.hooks?.afterResponse ?? []),
        ...(requestOptions.hooks?.afterResponse ?? []),
      ],
    },
    // Use request-level values if provided, otherwise instance values
    prefixUrl: requestOptions.prefixUrl ?? instanceOptions.prefixUrl,
    timeout: requestOptions.timeout ?? instanceOptions.timeout,
    validateResponse: requestOptions.validateResponse ?? instanceOptions.validateResponse ?? true,
    validateRequest: requestOptions.validateRequest ?? instanceOptions.validateRequest ?? true,
    throwHttpErrors: requestOptions.throwHttpErrors ?? instanceOptions.throwHttpErrors ?? true,
    retry: requestOptions.retry !== undefined
      ? requestOptions.retry
      : instanceOptions.retry,
  };
}

export type BuildRequestResult = {
  request: Request;
  normalizedOptions: NormalizedOptions;
  responseSchema?: GenericSchema;
  validateResponse: boolean;
  throwHttpErrors: boolean;
};

/**
 * Build a Request object from URL and options
 */
export async function buildRequest(
  url: string,
  method: HttpMethod,
  options: ValifetchOptions,
  instanceOptions: ValifetchInstanceOptions
): Promise<BuildRequestResult> {
  // Merge options
  const merged = mergeOptions(instanceOptions, options);
  const shouldValidateRequest = merged.validateRequest !== false;

  // Validate params if schema provided
  let validatedParams = options.params as Record<string, string | number> | undefined;
  if (options.paramsSchema && options.params && shouldValidateRequest) {
    validatedParams = validate({
      schema: options.paramsSchema,
      data: options.params,
      target: 'params',
    });
  }

  // Validate search params if schema provided
  let validatedSearch = options.searchParams;
  if (options.searchSchema && options.searchParams && shouldValidateRequest) {
    validatedSearch = validate({
      schema: options.searchSchema,
      data: options.searchParams,
      target: 'search',
    });
  }

  // Build URL
  const finalUrl = buildUrl({
    prefixUrl: merged.prefixUrl,
    path: url,
    params: validatedParams,
    searchParams: validatedSearch,
  });

  // Build headers
  const headers = merged.headers;

  // Handle JSON body
  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    // Validate body if schema provided
    let jsonData = options.json;
    if (options.bodySchema && shouldValidateRequest) {
      jsonData = validate({
        schema: options.bodySchema,
        data: options.json,
        target: 'body',
      });
    }

    body = JSON.stringify(jsonData);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
  }

  // Extract fetch-compatible options
  const fetchOptions: RequestInit = {
    method,
    headers,
    body,
    signal: options.signal,
    credentials: options.credentials,
    cache: options.cache,
    redirect: options.redirect,
    referrer: options.referrer,
    referrerPolicy: options.referrerPolicy,
    integrity: options.integrity,
    keepalive: options.keepalive,
    mode: options.mode,
  };

  const request = new Request(finalUrl.toString(), fetchOptions);

  // Build normalized options for hooks
  const normalizedOptions: NormalizedOptions = {
    ...merged,
    method,
    headers,
  };

  return {
    request,
    normalizedOptions,
    responseSchema: options.responseSchema,
    validateResponse: merged.validateResponse !== false,
    throwHttpErrors: merged.throwHttpErrors !== false,
  };
}
