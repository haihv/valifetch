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
 * @module
 */
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
  // Hooks
  BeforeRequestHook,
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
