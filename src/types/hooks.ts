import type { stop } from '../core/stop';
import type { ValifetchError } from '../errors/ValifetchError';
import type { NormalizedOptions } from './options';

/**
 * Hook called before each request
 * Can modify request or return early Response to bypass fetch
 */
export type BeforeRequestHook = (
  request: Request,
  options: NormalizedOptions
) => Request | Response | void | Promise<Request | Response | void>;

/**
 * Hook called after each response (before parsing)
 * Can modify response or return a new one
 */
export type AfterResponseHook = (
  request: Request,
  options: NormalizedOptions,
  response: Response
) => Response | void | Promise<Response | void>;

/**
 * Hook called after response is parsed
 * Can transform the parsed data
 */
export type AfterParseResponseHook<T = unknown> = (
  data: T,
  response: Response,
  request: Request
) => T | Promise<T>;

/**
 * State passed to `beforeRetry` hooks.
 * Exactly one of `response` / `error` is set, discriminated by `reason`.
 */
export type BeforeRetryState = {
  /**
   * The request that is about to be retried.
   * Return a new `Request` from the hook to replace it for the remaining attempts.
   */
  request: Request;
  /** Normalized request options */
  options: NormalizedOptions;
  /** 1-based number of the retry about to be performed (`1` = first retry, i.e. second attempt) */
  retryCount: number;
} & (
  | {
      /** Retry triggered by a retryable HTTP status */
      reason: 'status';
      /** The response that triggered the retry */
      response: Response;
      /** Never set when `reason` is `'status'` */
      error?: undefined;
    }
  | {
      /** Retry triggered by a network-level error */
      reason: 'network';
      /** The error thrown by `fetch` */
      error: Error;
      /** Never set when `reason` is `'network'` */
      response?: undefined;
    }
);

/**
 * Hook called before each retry is scheduled.
 * Return `stop` to abort retrying (the original failure is then handled as if
 * retries were exhausted), a `Request` to replace the request for subsequent
 * attempts, or nothing to leave the request unchanged.
 */
export type BeforeRetryHook = (
  state: BeforeRetryState
) => Request | typeof stop | void | Promise<Request | typeof stop | void>;

/**
 * Hook called just before a `ValifetchError` is thrown to the caller.
 * Must return the error to throw — the same instance (optionally mutated) or a
 * replacement `ValifetchError`.
 */
export type BeforeErrorHook = (
  error: ValifetchError
) => ValifetchError | Promise<ValifetchError>;

/**
 * All available hooks
 */
export type Hooks = {
  /** Hooks called before each request is sent */
  beforeRequest?: BeforeRequestHook[];
  /** Hooks called after each response is received, before parsing */
  afterResponse?: AfterResponseHook[];
  /** Hooks called after the response body has been parsed */
  afterParseResponse?: AfterParseResponseHook[];
  /** Hooks called before each retry attempt is scheduled */
  beforeRetry?: BeforeRetryHook[];
  /** Hooks called before a ValifetchError is thrown to the caller */
  beforeError?: BeforeErrorHook[];
};
