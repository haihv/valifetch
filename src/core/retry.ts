import type { HttpMethod, RetryOptions } from '../types';

/**
 * Default retry configuration: 2 retries on idempotent methods and common transient status codes,
 * with exponential backoff + 20% jitter, capped at 30 s.
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
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
): RetryOptions | false {
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
 * Returns a promise that resolves after `ms` milliseconds.
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
