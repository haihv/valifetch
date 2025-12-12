import type { GenericSchema } from 'valibot';
import type {
  HttpMethod,
  ValifetchInstanceOptions,
  NormalizedOptions,
  ValifetchBaseOptions,
  SearchParamsInit,
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

function mergeHeaders(
  instanceHeaders?: HeadersInit,
  requestHeaders?: HeadersInit
): Headers {
  const headers = new Headers();

  if (instanceHeaders) {
    const source = new Headers(instanceHeaders);
    source.forEach((value, key) => headers.set(key, value));
  }

  if (requestHeaders) {
    const source = new Headers(requestHeaders);
    source.forEach((value, key) => headers.set(key, value));
  }

  return headers;
}

export function mergeOptions(
  instanceOptions: ValifetchInstanceOptions,
  requestOptions: RequestOptions
): RequestOptions & { headers: Headers } {
  return {
    ...instanceOptions,
    ...requestOptions,
    headers: mergeHeaders(instanceOptions.headers, requestOptions.headers),
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

export type BuildRequestResult = {
  request: Request;
  normalizedOptions: NormalizedOptions;
  responseSchema?: GenericSchema;
  validateResponse: boolean;
  throwHttpErrors: boolean;
};

export async function buildRequest(
  url: string,
  method: HttpMethod,
  options: RequestOptions,
  instanceOptions: ValifetchInstanceOptions
): Promise<BuildRequestResult> {
  const merged = mergeOptions(instanceOptions, options);
  const shouldValidateRequest = merged.validateRequest !== false;

  let validatedParams = options.params;
  if (options.paramsSchema && options.params && shouldValidateRequest) {
    validatedParams = validate({
      schema: options.paramsSchema,
      data: options.params,
      target: 'params',
    }) as Record<string, string | number>;
  }

  let validatedSearch = options.searchParams;
  if (options.searchSchema && options.searchParams && shouldValidateRequest) {
    validatedSearch = validate({
      schema: options.searchSchema,
      data: options.searchParams,
      target: 'search',
    }) as SearchParamsInit;
  }

  const finalUrl = buildUrl({
    prefixUrl: merged.prefixUrl,
    path: url,
    params: validatedParams,
    searchParams: validatedSearch,
  });

  const headers = merged.headers;

  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    let jsonData: unknown = options.json;
    if (options.bodySchema && shouldValidateRequest) {
      jsonData = validate({
        schema: options.bodySchema,
        data: options.json,
        target: 'body',
      });
    }

    body = JSON.stringify(jsonData as object);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
  }

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
