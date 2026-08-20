/**
 * Valifetch — a type-safe HTTP client built on native `fetch` with
 * [Valibot](https://valibot.dev) schema validation.
 *
 * @example
 * ```ts
 * import valifetch from 'valifetch';
 * import * as v from 'valibot';
 *
 * const UserSchema = v.object({ id: v.number(), name: v.string() });
 * const user = await valifetch.get('/users/1', { responseSchema: UserSchema });
 * ```
 *
 * All public types, including the `valifetch/auth` and `valifetch/mock`
 * option types, are also available from the zero-runtime `valifetch/types`
 * entry point.
 *
 * @module
 */
export { stop } from './core/stop';
export { default, valifetch } from './core/valifetch';
export type {
  ValidationErrorInfo,
  ValifetchErrorOptions,
} from './errors/ValifetchError';
// Error class
export { ValifetchError } from './errors/ValifetchError';

// Types
export type {
  AfterParseResponseHook,
  AfterResponseHook,
  BeforeErrorHook,
  // Hooks
  BeforeRequestHook,
  BeforeRetryHook,
  BeforeRetryState,
  CancellablePromise,
  // Debug + progress
  DebugEvent,
  DebugOption,
  DownloadProgressEvent,
  ErrorCode,
  // Path params
  ExtractPathParams,
  GetOptions,
  HasPathParams,
  Hooks,
  // Options
  HttpMethod,
  InferResponseType,
  NormalizedOptions,
  PathParamsRecord,
  PostOptions,
  // Instance
  ResponseType,
  RetryOptions,
  SearchParamsInit,
  ValidationTarget,
  ValifetchBaseOptions,
  ValifetchInstance,
  ValifetchInstanceOptions,
  ValifetchOptions,
} from './types';

export type { CallableInstance } from './types/instance';
