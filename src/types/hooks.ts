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
 * All available hooks
 */
export type Hooks = {
  /** Hooks called before each request is sent */
  beforeRequest?: BeforeRequestHook[];
  /** Hooks called after each response is received, before parsing */
  afterResponse?: AfterResponseHook[];
  /** Hooks called after the response body has been parsed */
  afterParseResponse?: AfterParseResponseHook[];
};
