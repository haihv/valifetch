import { bench, describe } from 'vitest';
import {
  calculateRetryDelay,
  DEFAULT_RETRY_OPTIONS,
  normalizeRetryOptions,
  shouldRetry,
  shouldRetryNetworkError,
} from '../src/core/retry';

describe('retry (pure sync)', () => {
  bench('normalizeRetryOptions(undefined) — default path', () => {
    normalizeRetryOptions(undefined);
  });

  bench('normalizeRetryOptions(3) — number fast path', () => {
    normalizeRetryOptions(3);
  });

  bench('normalizeRetryOptions(false)', () => {
    normalizeRetryOptions(false);
  });

  bench('shouldRetry — positive (GET 503, attempt 0)', () => {
    shouldRetry('GET', 503, 0, DEFAULT_RETRY_OPTIONS);
  });

  bench('shouldRetry — negative (POST 200, attempt 0)', () => {
    shouldRetry('POST', 200, 0, DEFAULT_RETRY_OPTIONS);
  });

  bench('shouldRetry — negative (attempt >= limit)', () => {
    shouldRetry('GET', 503, 2, DEFAULT_RETRY_OPTIONS);
  });

  bench('shouldRetryNetworkError — positive', () => {
    shouldRetryNetworkError('GET', 0, DEFAULT_RETRY_OPTIONS);
  });

  bench('shouldRetryNetworkError — negative (POST)', () => {
    shouldRetryNetworkError('POST', 0, DEFAULT_RETRY_OPTIONS);
  });

  bench('calculateRetryDelay(0, opts)', () => {
    calculateRetryDelay(0, DEFAULT_RETRY_OPTIONS);
  });

  bench('calculateRetryDelay(1, opts)', () => {
    calculateRetryDelay(1, DEFAULT_RETRY_OPTIONS);
  });
});
