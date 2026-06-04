import type { GenericSchema, InferInput, InferOutput } from 'valibot';
import type { Hooks } from './hooks';
import type { ExtractPathParams, PathParamsRecord } from './params';

/**
 * HTTP methods supported by valifetch
 */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

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
  /** Methods to retry (default: GET, PUT, HEAD, DELETE, OPTIONS) */
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
  | 'ABORT_ERROR'
  | 'PARSE_ERROR';

/**
 * Validation target types
 */
export type ValidationTarget = 'response' | 'body' | 'params' | 'search';

/**
 * A structured event emitted during the request lifecycle when `debug` is enabled.
 * Each variant carries the data relevant to that stage of the pipeline.
 */
export type DebugEvent =
  | {
      /** Fired before each request attempt, including retries and hook-intercepted requests */
      type: 'request';
      /** The outgoing request */
      request: Request;
    }
  | {
      /** Fired after `fetch()` resolves with a response */
      type: 'response';
      /** The originating request */
      request: Request;
      /** The raw response received */
      response: Response;
      /** Which attempt number this response came from (1-based) */
      attempt: number;
    }
  | {
      /** Fired when a retry is about to be scheduled */
      type: 'retry';
      /** The originating request */
      request: Request;
      /** Which attempt just failed (1-based); `1` means the first attempt failed and a second is pending */
      attempt: number;
      /** Delay in milliseconds before the next attempt */
      delay: number;
      /** Why the retry was triggered */
      reason: 'status' | 'network';
    }
  | {
      /** Fired when the request is cancelled via `.cancel()` or an AbortController */
      type: 'cancel';
      /** The request that was cancelled */
      request: Request;
    };

/**
 * Controls structured debug logging of request lifecycle events.
 * - `true` — emits events via `console.debug('[valifetch]', event)`
 * - function — receives each `DebugEvent` directly for custom handling
 */
export type DebugOption = true | ((event: DebugEvent) => void);

/**
 * Progress event fired during response body download
 */
export type DownloadProgressEvent = {
  /** Bytes received so far */
  loaded: number;
  /** Total bytes expected (undefined when no Content-Length header is present) */
  total: number | undefined;
  /** Download percentage 0–100 (undefined when total is unknown) */
  percent: number | undefined;
};

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
  /** Deduplicate concurrent identical requests (same method + URL). Default: false */
  dedupe?: boolean;
  /** Form body — FormData sends multipart/form-data; URLSearchParams or plain object sends application/x-www-form-urlencoded */
  form?: FormData | URLSearchParams | Record<string, string>;
  /**
   * Callback fired as response body bytes are received.
   * Not called when `responseType` is `'stream'` or `'raw'` (caller owns the stream).
   */
  onDownloadProgress?: (event: DownloadProgressEvent) => void;
  /**
   * Enable structured debug logging of request lifecycle events.
   * Pass `true` to emit via `console.debug`, or a function to handle events directly.
   */
  debug?: DebugOption;
};

/**
 * Normalized options after merging defaults (internal use)
 */
export type NormalizedOptions = ValifetchBaseOptions & {
  /** HTTP method for the request */
  method: HttpMethod;
  /** Resolved headers object */
  headers: Headers;
};

/**
 * Conditionally requires `params` and `paramsSchema` based on whether the path contains dynamic segments.
 * Paths with `:param` segments require params; paths without disallow them.
 */
export type ParamsOption<
  TPath extends string,
  TParamsSchema extends GenericSchema | undefined,
> =
  ExtractPathParams<TPath> extends never
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
  TSearchSchema extends GenericSchema | undefined = undefined,
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
