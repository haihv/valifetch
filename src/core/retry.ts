import type { HttpMethod, RetryContext, RetryOptions } from '../types';

/**
 * Retry options with every built-in field resolved to a concrete value.
 * `shouldRetry` stays optional — it has no default.
 */
export type NormalizedRetryOptions = Required<
  Omit<RetryOptions, 'shouldRetry'>
> &
  Pick<RetryOptions, 'shouldRetry'>;

/**
 * Default retry configuration: 2 retries on idempotent methods and common transient status codes,
 * with exponential backoff + 20% jitter, capped at 30 s.
 */
export const DEFAULT_RETRY_OPTIONS: NormalizedRetryOptions = {
  limit: 2,
  methods: ['GET', 'PUT', 'HEAD', 'DELETE', 'OPTIONS'],
  statusCodes: [408, 413, 429, 500, 502, 503, 504],
  delay: (attemptCount: number) => {
    const base = 0.3 * Math.pow(2, attemptCount);
    const jitter = base * 0.2 * Math.random();
    return Math.min((base + jitter) * 1000, 30000);
  },
};

/**
 * Normalize the `retry` option to a `RetryOptions` object or `false`.
 * - `false` → disabled
 * - `undefined` → default options
 * - `number` → default options with custom limit
 * - `RetryOptions` → merged with defaults
 */
export function normalizeRetryOptions(
  retry: RetryOptions | number | false | undefined
): NormalizedRetryOptions | false {
  if (retry === false) {
    return false;
  }

  if (retry === undefined) {
    return { ...DEFAULT_RETRY_OPTIONS };
  }

  if (typeof retry === 'number') {
    return { ...DEFAULT_RETRY_OPTIONS, limit: retry };
  }

  return {
    ...DEFAULT_RETRY_OPTIONS,
    ...retry,
  };
}

/**
 * Determine whether a failed request should be retried.
 * @param method - HTTP method of the request
 * @param statusCode - HTTP status code of the response
 * @param attemptCount - Number of attempts already made (0-based)
 * @param options - Retry configuration
 */
export function shouldRetry(
  method: HttpMethod,
  statusCode: number,
  attemptCount: number,
  options: RetryOptions
): boolean {
  const limit = options.limit ?? DEFAULT_RETRY_OPTIONS.limit;
  const methods = options.methods ?? DEFAULT_RETRY_OPTIONS.methods;
  const statusCodes = options.statusCodes ?? DEFAULT_RETRY_OPTIONS.statusCodes;

  if (attemptCount >= limit) {
    return false;
  }

  if (!methods.includes(method)) {
    return false;
  }

  if (!statusCodes.includes(statusCode)) {
    return false;
  }

  return true;
}

/**
 * Calculate the delay in milliseconds before the next retry attempt.
 * @param attemptCount - Number of attempts already made (0-based)
 * @param options - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attemptCount: number,
  options: RetryOptions
): number {
  const delayFn = options.delay ?? DEFAULT_RETRY_OPTIONS.delay;
  return delayFn(attemptCount);
}

/**
 * Determine whether a network-level error (e.g. `TypeError: Failed to fetch`) should be retried.
 * Applies the same method guard as {@link shouldRetry} — non-idempotent methods (e.g. POST) are
 * not retried by default to prevent duplicate submissions.
 * @param method - HTTP method of the request
 * @param attemptCount - Number of attempts already made (0-based)
 * @param options - Retry configuration
 */
export function shouldRetryNetworkError(
  method: HttpMethod,
  attemptCount: number,
  options: RetryOptions
): boolean {
  const limit = options.limit ?? DEFAULT_RETRY_OPTIONS.limit;
  const methods = options.methods ?? DEFAULT_RETRY_OPTIONS.methods;

  if (attemptCount >= limit) {
    return false;
  }

  if (!methods.includes(method)) {
    return false;
  }

  return true;
}

/**
 * Returns a promise that resolves after `ms` milliseconds.
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read the `Retry-After` response header and return the prescribed delay in milliseconds.
 *
 * The header value may be:
 * - A non-negative integer (seconds): `Retry-After: 120` → 120 000 ms
 * - An HTTP-date: `Retry-After: Wed, 21 Oct 2015 07:28:00 GMT` → ms until that date (min 0)
 *
 * Returns `null` when the header is absent or cannot be parsed.
 *
 * @param response - The HTTP response to inspect
 * @returns Delay in milliseconds, or `null` if the header is absent or unparseable
 */
export function getRetryAfterDelay(response: Response): number | null {
  const value = response.headers.get('retry-after');
  if (value === null) return null;

  const seconds = parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());

  return null;
}

/**
 * Decide whether to retry, consulting `options.shouldRetry` first and falling back
 * to the built-in check.
 * @param context - The failure being considered for a retry
 * @param options - Normalized retry configuration
 * @param defaultDecision - The built-in status-code + method check to defer to
 * @returns `true` when the failure should be retried
 */
export async function resolveRetryDecision(
  context: RetryContext,
  options: NormalizedRetryOptions,
  defaultDecision: () => boolean
): Promise<boolean> {
  // `limit` bounds the predicate too, so a `() => true` predicate cannot retry forever.
  if (context.retryCount > options.limit) {
    return false;
  }

  const verdict = options.shouldRetry
    ? await options.shouldRetry(context)
    : undefined;

  return verdict ?? defaultDecision();
}
