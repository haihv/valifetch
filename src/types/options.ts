import type { GenericSchema, InferInput, InferOutput } from 'valibot';
import type { Hooks } from './hooks';
import type { ExtractPathParams, PathParamsRecord } from './params';

/**
 * HTTP methods supported by valifetch
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Search params can be various formats
 */
export type SearchParamsInit =
  | string
  | URLSearchParams
  | Record<string, string | number | boolean | undefined | null>
  | Array<[string, string | number | boolean]>;

/**
 * Retry configuration
 */
export type RetryOptions = {
  /** Max retry attempts (default: 2) */
  limit?: number;
  /** Methods to retry (default: GET, PUT, HEAD, DELETE, OPTIONS, TRACE) */
  methods?: HttpMethod[];
  /** Status codes to retry (default: 408, 413, 429, 500, 502, 503, 504) */
  statusCodes?: number[];
  /** Custom delay function (attempt starts at 0) */
  delay?: (attemptCount: number) => number;
};

/**
 * Error codes for ValifetchError
 */
export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'VALIDATION_ERROR'
  | 'HTTP_ERROR'
  | 'ABORT_ERROR';

/**
 * Validation target types
 */
export type ValidationTarget = 'response' | 'body' | 'params' | 'search';

/**
 * Base options without schemas (for internal use)
 */
export type ValifetchBaseOptions = Omit<RequestInit, 'body' | 'method'> & {
  /** Base URL prefix for all requests */
  prefixUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Search/query parameters */
  searchParams?: SearchParamsInit;
  /** Enable/disable response schema validation (default: true) */
  validateResponse?: boolean;
  /** Enable/disable request body/params/search validation (default: true) */
  validateRequest?: boolean;
  /** Throw on non-2xx status codes (default: true) */
  throwHttpErrors?: boolean;
  /** Retry configuration or limit number */
  retry?: RetryOptions | number | false;
  /** Hooks for request lifecycle */
  hooks?: Hooks;
};

/**
 * Normalized options after merging defaults (internal use)
 */
export type NormalizedOptions = ValifetchBaseOptions & {
  method: HttpMethod;
  headers: Headers;
};

/**
 * Helper type to conditionally require params based on path
 */
export type ParamsOption<
  TPath extends string,
  TParamsSchema extends GenericSchema | undefined
> = ExtractPathParams<TPath> extends never
  ? {
      params?: undefined;
      paramsSchema?: undefined;
    }
  : TParamsSchema extends GenericSchema
    ? {
        params: InferInput<TParamsSchema>;
        paramsSchema: TParamsSchema;
      }
    : {
        params: PathParamsRecord<TPath>;
        paramsSchema?: undefined;
      };

/**
 * Schema-aware options with full type inference
 */
export type ValifetchOptions<
  TPath extends string = string,
  TResponseSchema extends GenericSchema | undefined = undefined,
  TBodySchema extends GenericSchema | undefined = undefined,
  TParamsSchema extends GenericSchema | undefined = undefined,
  TSearchSchema extends GenericSchema | undefined = undefined
> = ValifetchBaseOptions & {
  /** Schema to validate response body */
  responseSchema?: TResponseSchema;
  /** Schema to validate request body */
  bodySchema?: TBodySchema;
  /** Schema to validate URL path params */
  paramsSchema?: TParamsSchema;
  /** Schema to validate search/query params */
  searchSchema?: TSearchSchema;
  /** JSON body - validated against bodySchema if provided */
  json?: TBodySchema extends GenericSchema ? InferInput<TBodySchema> : unknown;
  /** URL path parameters */
  params?: TParamsSchema extends GenericSchema
    ? InferInput<TParamsSchema>
    : ExtractPathParams<TPath> extends never
      ? undefined
      : PathParamsRecord<TPath>;
};

/**
 * Instance options for create/extend
 */
export type ValifetchInstanceOptions = ValifetchBaseOptions & {
  /** Default headers for all requests */
  headers?: HeadersInit;
};

/**
 * Infer response type from schema or fallback to unknown
 */
export type InferResponseType<TSchema> = TSchema extends GenericSchema
  ? InferOutput<TSchema>
  : unknown;
