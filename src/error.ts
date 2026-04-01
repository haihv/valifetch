/**
 * Standalone error export — import `ValifetchError` and related types without
 * pulling in the full valifetch client.
 *
 * @example
 * ```ts
 * import { ValifetchError } from 'valifetch/error';
 * ```
 *
 * @module
 */

export type {
  ValidationErrorInfo,
  ValifetchErrorOptions,
} from './errors/ValifetchError';
export { ValifetchError } from './errors/ValifetchError';
export type { ErrorCode, ValidationTarget } from './types';
