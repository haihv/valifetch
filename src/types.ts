/**
 * Standalone types export — import valifetch TypeScript types without pulling
 * in any runtime code.
 *
 * @example
 * ```ts
 * import type { ValifetchInstance, ValifetchOptions } from 'valifetch/types';
 * ```
 *
 * @module
 */

// Auth option types (also available from `valifetch/auth`)
export type { JwtRefreshOptions } from './auth';
// Error detail types (also available from the root and `valifetch/error` entries)
export type {
  ValidationErrorInfo,
  ValifetchErrorOptions,
} from './errors/ValifetchError';
// Mock types (also available from `valifetch/mock`)
export type { MockCall, MockHandler, ValifetchMock } from './mock/types';
export type {
  // Hooks
  AfterParseResponseHook,
  AfterResponseHook,
  BeforeErrorHook,
  BeforeRequestHook,
  BeforeRetryHook,
  BeforeRetryState,
  CallableInstance,
  // Instance
  CancellablePromise,
  // Options
  DebugEvent,
  DebugOption,
  DownloadProgressEvent,
  ErrorCode,
  // Path params
  ExtractPathParams,
  GetOptions,
  HasPathParams,
  Hooks,
  HttpMethod,
  InferResponseType,
  NormalizedOptions,
  PathParamsRecord,
  PostOptions,
  ResponseType,
  RetryOptions,
  SearchParamsInit,
  ValidationTarget,
  ValifetchBaseOptions,
  ValifetchInstance,
  ValifetchInstanceOptions,
  ValifetchOptions,
} from './types/index';
