import type { HttpMethod, RetryOptions } from '../types';

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

export function calculateRetryDelay(
  attemptCount: number,
  options: RetryOptions
): number {
  const delayFn = options.delay ?? DEFAULT_RETRY_OPTIONS.delay;
  return delayFn(attemptCount);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
