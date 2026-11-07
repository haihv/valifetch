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
 * Largest delay `setTimeout` honours (2^31 - 1 ms, ~24.8 days). Larger values
 * overflow and fire after ~1 ms, so delays are clamped to this instead.
 */
export const MAX_TIMER_DELAY = 2_147_483_647;

/**
 * Default retry configuration: 2 retries on idempotent methods and common transient status codes,
 * with exponential backoff + 20% jitter, capped at 30 s. A server-sent `Retry-After` is honoured
 * up to 60 s; a longer one stops retrying instead.
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
  maxRetryAfter: 60_000,
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

  const normalized: NormalizedRetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...retry,
  };
  // An invalid cap (non-number, NaN, negative) would make every Retry-After
  // look "over the cap" or never compare at all; fall back to the default.
  // `Infinity` is a valid "no cap".
  if (!isValidLimit(normalized.maxRetryAfter)) {
    normalized.maxRetryAfter = DEFAULT_RETRY_OPTIONS.maxRetryAfter;
  }
  return normalized;
}

/**
 * Whether `value` is usable as a size or time cap: a non-negative number,
 * `Infinity` included. Rejects non-numbers, `NaN` and negatives.
 * @param value - The user-supplied cap
 * @returns `true` when `value` can be used as-is
 */
export function isValidLimit(value: unknown): value is number {
  return typeof value === 'number' && value >= 0;
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
  // `Math.max(0, NaN)` is NaN, so the NaN check comes first: a broken `delay`
  // function must not reach `setTimeout` as NaN or as an overflowing value.
  const clamped = Number.isNaN(ms)
    ? 0
    : Math.max(0, Math.min(ms, MAX_TIMER_DELAY));
  return new Promise((resolve) => setTimeout(resolve, clamped));
}

/**
 * Read the `Retry-After` response header and return the prescribed delay in milliseconds.
 *
 * Parsing is strict:
 * - delay-seconds only when the trimmed value is all ASCII digits (`/^\d+$/`):
 *   `Retry-After: 120` → 120 000 ms
 * - otherwise an HTTP-date, accepted only when `Date.parse` succeeds AND the value
 *   contains a letter (real HTTP-dates carry day/month names):
 *   `Retry-After: Wed, 21 Oct 2015 07:28:00 GMT` → ms until that date (min 0)
 *
 * Anything else (`1.5`, `1e9`, `0x10`, `-1`, `5abc`) returns `null`, so the caller
 * falls back to its normal backoff. The value is NOT clamped here: the retry loop
 * compares it to `maxRetryAfter` and gives up retrying when it is larger.
 *
 * @param response - The HTTP response to inspect
 * @returns Delay in milliseconds, or `null` if the header is absent or unparseable
 */
export function getRetryAfterDelay(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (header === null) return null;
  const value = header.trim();

  if (/^\d+$/.test(value)) {
    return Number(value) * 1000;
  }

  const date = Date.parse(value);
  if (Number.isFinite(date) && /[a-z]/i.test(value)) {
    return Math.max(0, date - Date.now());
  }

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
