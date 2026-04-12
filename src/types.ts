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
export type {
  // Hooks
  AfterParseResponseHook,
  AfterResponseHook,
  BeforeRequestHook,
  CallableInstance,
  // Instance
  CancellablePromise,
  // Options
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
