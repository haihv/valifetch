/**
 * Sentinel returned from a `beforeRetry` hook to abort the retry loop.
 *
 * Registered globally via `Symbol.for` so the CJS and ESM builds share a single
 * identity — a plain `Symbol()` would produce two distinct values and `return
 * stop` would be silently ignored for consumers that mix module formats.
 */
export const stop: unique symbol = Symbol.for('valifetch.stop');
