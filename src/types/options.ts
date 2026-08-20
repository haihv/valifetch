import type { GenericSchema, InferInput, InferOutput } from 'valibot';
import type { Hooks } from './hooks';
import type { ResponseType } from './instance';
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
  | Array<[string, string | number | boolean | undefined | null]>;

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
  /**
   * Custom delay function returning the milliseconds to wait before the next
   * attempt. `attemptCount` is 0-based, so `delay(0)` precedes the first retry.
   *
   * @default (attemptCount) => 0.3 * 2 ** attemptCount seconds, plus up to 20% jitter, capped at 30 s
   */
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
      /** 1-based number of the retry about to be performed (`1` = first retry, i.e. second attempt) */
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
export type ValifetchBaseOptions = Omit<
  RequestInit,
  'body' | 'method' | 'window'
> & {
  /** Base URL prefix for all requests */
  prefixUrl?: string;
  /**
   * Request timeout in milliseconds.
   *
   * @default undefined — requests never time out; `0` also disables the timeout
   */
  timeout?: number;
  /**
   * Search/query parameters.
   *
   * Instance-level values act as defaults: per-request params are merged on top,
   * and a key present in both is taken from the request (all instance-level
   * entries for that key are dropped).
   */
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
  /**
   * Deduplicate concurrent identical requests — same method plus fully-resolved
   * URL (after `prefixUrl`, path params and merged search params), scoped per
   * instance. Calling `.cancel()` on a deduplicated promise aborts the shared
   * request for every caller awaiting it.
   *
   * @default false
   */
  dedupe?: boolean;
  /**
   * Callback fired as response body bytes are received.
   * Not called when `responseType` is `'stream'`, `'raw'` or `'sse'` — the caller
   * owns the stream in those modes.
   */
  onDownloadProgress?: (event: DownloadProgressEvent) => void;
  /**
   * Enable structured debug logging of request lifecycle events.
   * Pass `true` to emit via `console.debug`, or a function to handle events directly.
   */
  debug?: DebugOption;
};

/**
 * Fully resolved request options as seen by hooks, after instance and per-request
 * options have been merged and defaults applied.
 *
 * `retry` is carried through unnormalized (still `RetryOptions | number | false |
 * undefined`); the retry loop normalizes it internally.
 */
export type NormalizedOptions = Omit<ValifetchBaseOptions, 'signal'> & {
  /** HTTP method for the request */
  method: HttpMethod;
  /** Resolved headers object, instance headers overridden by request headers */
  headers: Headers;
  /**
   * The composed abort signal actually passed to `fetch` — the caller's signal
   * combined with the controller behind `.cancel()`, not the caller's raw signal.
   */
  signal: AbortSignal;
  /** Concatenated instance and request hooks (instance hooks run first) */
  hooks: Hooks;
  /** Resolved request validation flag */
  validateRequest: boolean;
  /** Resolved response validation flag */
  validateResponse: boolean;
  /** Resolved flag controlling whether non-2xx statuses throw */
  throwHttpErrors: boolean;
  /** Requested response format (per-call only; `undefined` means `'json'`) */
  responseType?: ResponseType;
  /** Schema used to validate the response body, when provided */
  responseSchema?: GenericSchema;
  /** Schema used to validate the request body, when provided */
  bodySchema?: GenericSchema;
  /** Schema used to validate path params, when provided */
  paramsSchema?: GenericSchema;
  /** Schema used to validate search params, when provided */
  searchSchema?: GenericSchema;
  /** The JSON body of the request, when provided */
  json?: unknown;
  /** The form body of the request, when provided */
  form?: FormData | URLSearchParams | Record<string, string>;
  /** Path parameter values interpolated into the URL */
  params?: Record<string, string | number>;
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
  /**
   * Form body — `FormData` sends `multipart/form-data`; `URLSearchParams` or a
   * plain object sends `application/x-www-form-urlencoded`. Mutually exclusive
   * with `json`, and accepted per request only (never at instance level).
   */
  form?: FormData | URLSearchParams | Record<string, string>;
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
export type ValifetchInstanceOptions = Omit<ValifetchBaseOptions, 'signal'> & {
  /** Default headers for all requests */
  headers?: HeadersInit;
};

/**
 * Infer response type from schema or fallback to unknown
 */
export type InferResponseType<TSchema> = TSchema extends GenericSchema
  ? InferOutput<TSchema>
  : unknown;
