/**
 * Standalone mock export — testing utilities for intercepting requests
 * without patching `globalThis.fetch`.
 *
 * @example
 * ```ts
 * import { createMock } from 'valifetch/mock';
 * ```
 *
 * @module
 */

export { createMock } from './mock/index';
export type { MockCall, MockHandler, ValifetchMock } from './mock/types';
