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
 * Hook called after each response
 * Can modify response or return a new one
 */
export type AfterResponseHook = (
  request: Request,
  options: NormalizedOptions,
  response: Response
) => Response | void | Promise<Response | void>;

/**
 * All available hooks
 */
export type Hooks = {
  beforeRequest?: BeforeRequestHook[];
  afterResponse?: AfterResponseHook[];
};
