// Main export
export { valifetch, valifetch as default } from './core/valifetch';
export type {
  ValidationErrorInfo,
  ValifetchErrorOptions,
} from './errors/ValifetchError';
// Error class
export { ValifetchError } from './errors/ValifetchError';

// Types
export type {
  AfterResponseHook,
  // Hooks
  BeforeRequestHook,
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
