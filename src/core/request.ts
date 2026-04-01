import type { GenericSchema } from 'valibot';
import type {
  Hooks,
  HttpMethod,
  NormalizedOptions,
  SearchParamsInit,
  ValifetchBaseOptions,
  ValifetchInstanceOptions,
} from '../types';
import { buildUrl } from '../url/builder';
import { validate } from '../validation/validate';

type RequestOptions = ValifetchBaseOptions & {
  responseSchema?: GenericSchema;
  bodySchema?: GenericSchema;
  paramsSchema?: GenericSchema;
  searchSchema?: GenericSchema;
  json?: unknown;
  params?: Record<string, string | number>;
};

/**
 * Merge headers from instance and request options
 * Request headers take precedence over instance headers
 */
function mergeHeaders(
  instanceHeaders?: HeadersInit,
  requestHeaders?: HeadersInit
): Headers {
  if (!instanceHeaders && !requestHeaders) {
    return new Headers();
  }

  if (!instanceHeaders) {
    return new Headers(requestHeaders);
  }

  if (!requestHeaders) {
    return new Headers(instanceHeaders);
  }

  // Both have headers - merge them (instance first, then request overrides)
  const headers = new Headers(instanceHeaders);

  if (requestHeaders instanceof Headers) {
    requestHeaders.forEach((value, key) => headers.set(key, value));
  } else if (Array.isArray(requestHeaders)) {
    for (const [key, value] of requestHeaders) {
      headers.set(key, value);
    }
  } else {
    for (const [key, value] of Object.entries(requestHeaders)) {
      headers.set(key, value);
    }
  }

  return headers;
}

/**
 * Merge hooks from instance and request options
 * Hooks are concatenated (instance hooks run first, then request hooks)
 */
function mergeHooks(
  instanceHooks?: Hooks,
  requestHooks?: Hooks
): Hooks | undefined {
  if (!instanceHooks && !requestHooks) return undefined;
  if (!instanceHooks) return requestHooks;
  if (!requestHooks) return instanceHooks;

  // Both have hooks - merge them
  return {
    beforeRequest:
      instanceHooks.beforeRequest || requestHooks.beforeRequest
        ? [
            ...(instanceHooks.beforeRequest ?? []),
            ...(requestHooks.beforeRequest ?? []),
          ]
        : undefined,
    afterResponse:
      instanceHooks.afterResponse || requestHooks.afterResponse
        ? [
            ...(instanceHooks.afterResponse ?? []),
            ...(requestHooks.afterResponse ?? []),
          ]
        : undefined,
    afterParseResponse:
      instanceHooks.afterParseResponse || requestHooks.afterParseResponse
        ? [
            ...(instanceHooks.afterParseResponse ?? []),
            ...(requestHooks.afterParseResponse ?? []),
          ]
        : undefined,
  };
}

/**
 * Merge instance options with request options
 * Request options take precedence over instance options
 */
export function mergeOptions(
  instanceOptions: ValifetchInstanceOptions,
  requestOptions: RequestOptions
): RequestOptions & { headers: Headers } {
  const mergedHooks = mergeHooks(instanceOptions.hooks, requestOptions.hooks);

  return {
    ...instanceOptions,
    ...requestOptions,
    headers: mergeHeaders(instanceOptions.headers, requestOptions.headers),
    hooks: mergedHooks ?? {},
    prefixUrl: requestOptions.prefixUrl ?? instanceOptions.prefixUrl,
    timeout: requestOptions.timeout ?? instanceOptions.timeout,
    validateResponse:
      requestOptions.validateResponse ??
      instanceOptions.validateResponse ??
      true,
    validateRequest:
      requestOptions.validateRequest ?? instanceOptions.validateRequest ?? true,
    throwHttpErrors:
      requestOptions.throwHttpErrors ?? instanceOptions.throwHttpErrors ?? true,
    retry:
      requestOptions.retry !== undefined
        ? requestOptions.retry
        : instanceOptions.retry,
  };
}

/** Result of {@link buildRequest} containing the constructed `Request` and derived options */
export type BuildRequestResult = {
  request: Request;
  normalizedOptions: NormalizedOptions;
  responseSchema?: GenericSchema;
  validateResponse: boolean;
  throwHttpErrors: boolean;
};

/**
 * Build a Request object from URL, method, and options
 */
export async function buildRequest(
  url: string,
  method: HttpMethod,
  options: RequestOptions,
  instanceOptions: ValifetchInstanceOptions
): Promise<BuildRequestResult> {
  const merged = mergeOptions(instanceOptions, options);
  const shouldValidateRequest = merged.validateRequest !== false;

  // Validate path params if schema provided
  let validatedParams = options.params;
  if (options.paramsSchema && options.params && shouldValidateRequest) {
    validatedParams = validate({
      schema: options.paramsSchema,
      data: options.params,
      target: 'params',
    }) as Record<string, string | number>;
  }

  // Validate search params if schema provided
  let validatedSearch = options.searchParams;
  if (options.searchSchema && options.searchParams && shouldValidateRequest) {
    validatedSearch = validate({
      schema: options.searchSchema,
      data: options.searchParams,
      target: 'search',
    }) as SearchParamsInit;
  }

  // Build the final URL
  const finalUrl = buildUrl({
    prefixUrl: merged.prefixUrl,
    path: url,
    params: validatedParams,
    searchParams: validatedSearch,
  });

  const headers = merged.headers;

  // Handle request body (json or form — mutually exclusive)
  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    let jsonData: unknown = options.json;

    // Validate body if schema provided
    if (options.bodySchema && shouldValidateRequest) {
      jsonData = validate({
        schema: options.bodySchema,
        data: options.json,
        target: 'body',
      });
    }

    body = JSON.stringify(jsonData as object);

    // Set default headers for JSON
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
  } else if (options.form !== undefined) {
    if (options.form instanceof FormData) {
      // Let the browser set Content-Type with the correct multipart boundary
      body = options.form;
    } else {
      body =
        options.form instanceof URLSearchParams
          ? options.form
          : new URLSearchParams(options.form);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
      }
    }
  }

  // Build fetch options (use merged to include instance-level options)
  const fetchOptions: RequestInit = {
    method,
    headers,
    body,
    signal: options.signal,
    credentials: merged.credentials,
    cache: merged.cache,
    redirect: merged.redirect,
    referrer: merged.referrer,
    referrerPolicy: merged.referrerPolicy,
    integrity: merged.integrity,
    keepalive: merged.keepalive,
    mode: merged.mode,
  };

  const request = new Request(finalUrl.toString(), fetchOptions);

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
