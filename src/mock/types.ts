import type { Hooks, HttpMethod } from '../types';

/**
 * A recorded request intercepted by the mock.
 * Inspect these via `mock.calls()` and `mock.lastCall()` to assert on what was sent.
 */
export type MockCall = {
  /** HTTP method of the intercepted request */
  method: HttpMethod;
  /** Full URL of the intercepted request */
  url: string;
  /** Request headers as a plain string-to-string object */
  headers: Record<string, string>;
  /**
   * Parsed request body.
   * JSON-parsed object/array when `Content-Type` is `application/json`,
   * decoded text for every other body (including raw `body` payloads),
   * `null` when the request has no body.
   */
  body: unknown;
  /** URL search/query parameters */
  searchParams: URLSearchParams;
};

/**
 * Builder returned by `mock.when()` and the HTTP method shorthands.
 * Call `reply` or `replyOnce` (chainable) to register fixture responses.
 */
export type MockHandler = {
  /**
   * Register a fixture response for all matching requests.
   * If multiple `reply`/`replyOnce` calls are made on the same handler,
   * responses are consumed in order (queue). This response stays at the end of the queue
   * and is reused once all preceding `replyOnce` responses are consumed.
   * @param status - HTTP status code
   * @param body - Response body — always serialised via `JSON.stringify` (objects, arrays, strings, `null`).
   *   Pass `null` to produce a JSON `null` response. Omit entirely only for genuinely bodyless statuses
   *   (e.g. 204 No Content) — omitting on a 200/201 response will cause valifetch's JSON parser to throw.
   * @param headers - Additional response headers
   * @returns The same `MockHandler`, for chaining additional `reply`/`replyOnce` calls.
   */
  reply(status: number, body?: unknown, headers?: HeadersInit): MockHandler;
  /**
   * Register a fixture response that is consumed on the first matching request only.
   * Subsequent requests fall through to the next registered response (or the real `fetch` if none remain).
   * @param status - HTTP status code
   * @param body - Response body — always serialised via `JSON.stringify` (objects, arrays, strings, `null`).
   *   Pass `null` to produce a JSON `null` response. Omit entirely only for genuinely bodyless statuses
   *   (e.g. 204 No Content) — omitting on a 200/201 response will cause valifetch's JSON parser to throw.
   * @param headers - Additional response headers
   * @returns The same `MockHandler`, for chaining additional `reply`/`replyOnce` calls.
   */
  replyOnce(status: number, body?: unknown, headers?: HeadersInit): MockHandler;
};

/**
 * A valifetch mock instance created by `createMock()`.
 *
 * Attach it to a valifetch instance via `extend({ hooks: mock.hooks })`.
 * Requests that match a registered pattern are intercepted and never reach the network.
 * Unmatched requests fall through to the real `fetch`.
 */
export type ValifetchMock = {
  /** Register a mock handler for GET requests matching `pattern` */
  get(pattern: string | RegExp): MockHandler;
  /** Register a mock handler for POST requests matching `pattern` */
  post(pattern: string | RegExp): MockHandler;
  /** Register a mock handler for PUT requests matching `pattern` */
  put(pattern: string | RegExp): MockHandler;
  /** Register a mock handler for PATCH requests matching `pattern` */
  patch(pattern: string | RegExp): MockHandler;
  /** Register a mock handler for DELETE requests matching `pattern` */
  delete(pattern: string | RegExp): MockHandler;
  /** Register a mock handler for HEAD requests matching `pattern` */
  head(pattern: string | RegExp): MockHandler;
  /** Register a mock handler for OPTIONS requests matching `pattern` */
  options(pattern: string | RegExp): MockHandler;
  /**
   * Register a mock handler for the given method and pattern.
   * Pass `'*'` as `method` to match any HTTP method.
   */
  when(method: HttpMethod | '*', pattern: string | RegExp): MockHandler;
  /** Returns all recorded calls in the order they were intercepted */
  calls(): MockCall[];
  /**
   * Returns the last recorded call, or `undefined` if no requests have been intercepted yet.
   */
  lastCall(): MockCall | undefined;
  /** Clear all registered handlers and recorded calls */
  reset(): void;
  /**
   * Hooks to attach to a valifetch instance.
   *
   * @example
   * ```ts
   * const api = valifetch.extend({ hooks: mock.hooks });
   * ```
   */
  hooks: Required<Pick<Hooks, 'beforeRequest'>>;
};
