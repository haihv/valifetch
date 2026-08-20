import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { stop } from '../../src/core/hooks';
import {
  DEFAULT_RETRY_OPTIONS,
  normalizeRetryOptions,
  resolveRetryDecision,
} from '../../src/core/retry';
import { valifetch } from '../../src/core/valifetch';
import { ValifetchError } from '../../src/errors/ValifetchError';
import type { RetryContext } from '../../src/types';

describe('retry/shouldRetry predicate', () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const jsonResponse = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  describe('return values', () => {
    it('should retry a POST 500 when the predicate returns true', async () => {
      // Arrange
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({}, 500))
        .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
      const client = valifetch.create({
        retry: { delay: () => 0, shouldRetry: () => true },
      });

      // Act
      const result = await client.post('https://api.example.com/items', {
        json: { name: 'a' },
      });

      // Assert
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should not retry a GET 503 when the predicate returns false', async () => {
      // Arrange
      fetchSpy.mockResolvedValue(jsonResponse({}, 503));
      const client = valifetch.create({
        retry: { delay: () => 0, shouldRetry: () => false },
      });

      // Act
      const error = await client
        .get('https://api.example.com/flaky')
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('HTTP_ERROR');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should defer to the built-in check when the predicate returns undefined', async () => {
      // Arrange
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
      const client = valifetch.create({
        retry: { limit: 1, delay: () => 0, shouldRetry: () => undefined },
      });

      // Act
      const result = await client.get('https://api.example.com/flaky');

      // Assert
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should keep POST 500 unretried when the predicate returns undefined', async () => {
      // Arrange
      fetchSpy.mockResolvedValue(jsonResponse({}, 500));
      const client = valifetch.create({
        retry: { delay: () => 0, shouldRetry: () => undefined },
      });

      // Act
      const error = await client
        .post('https://api.example.com/items', { json: { name: 'a' } })
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(ValifetchError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('async predicate', () => {
    it('should decide from the response body and leave the response parseable', async () => {
      // Arrange
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ code: 'STALE_VERSION' }, 409))
        .mockResolvedValueOnce(jsonResponse({ code: 'CONFLICT' }, 409));
      const client = valifetch.create({
        retry: {
          delay: () => 0,
          shouldRetry: async ({ response }) => {
            if (!response) return false;
            const body = (await response.clone().json()) as { code: string };
            return body.code === 'STALE_VERSION';
          },
        },
      });

      // Act
      const error = await client
        .get('https://api.example.com/doc')
        .catch((e: unknown) => e);

      // Assert — retried once, then the second 409 was refused by the predicate
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).responseBody).toEqual({
        code: 'CONFLICT',
      });
    });

    it('should leave a successful response parseable after the predicate clones it', async () => {
      // Arrange
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ code: 'STALE_VERSION' }, 409))
        .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
      const client = valifetch.create({
        retry: {
          delay: () => 0,
          shouldRetry: async ({ response }) => {
            if (!response) return false;
            const body = (await response.clone().json()) as { code: string };
            return body.code === 'STALE_VERSION';
          },
        },
      });

      // Act
      const result = await client.get('https://api.example.com/doc');

      // Assert
      expect(result).toEqual({ ok: true });
    });
  });

  describe('network failures', () => {
    it('should retry a POST network error when the predicate opts in', async () => {
      // Arrange
      fetchSpy
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
      const client = valifetch.create({
        retry: {
          delay: () => 0,
          shouldRetry: ({ reason }) => reason === 'network',
        },
      });

      // Act
      const result = await client.post('https://api.example.com/items', {
        json: { name: 'a' },
      });

      // Assert
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should surface NETWORK_ERROR without retrying when the predicate returns false', async () => {
      // Arrange
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
      const client = valifetch.create({
        retry: { delay: () => 0, shouldRetry: () => false },
      });

      // Act
      const error = await client
        .get('https://api.example.com/flaky')
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('NETWORK_ERROR');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('limit', () => {
    it('should stay bounded by limit and stop consulting the predicate', async () => {
      // Arrange
      const retryCounts: number[] = [];
      fetchSpy.mockResolvedValue(jsonResponse({}, 500));
      const client = valifetch.create({
        retry: {
          limit: 1,
          delay: () => 0,
          shouldRetry: ({ retryCount }) => {
            retryCounts.push(retryCount);
            return true;
          },
        },
      });

      // Act
      const error = await client
        .post('https://api.example.com/items', { json: { name: 'a' } })
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(ValifetchError);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(retryCounts).toEqual([1]);
    });
  });

  describe('context shape', () => {
    it('should pass a 1-based retryCount with the status discriminants', async () => {
      // Arrange
      const contexts: RetryContext[] = [];
      fetchSpy.mockResolvedValue(jsonResponse({}, 500));
      const client = valifetch.create({
        retry: {
          limit: 2,
          delay: () => 0,
          shouldRetry: (context) => {
            contexts.push(context);
            return true;
          },
        },
      });

      // Act
      await client.get('https://api.example.com/flaky').catch(() => undefined);

      // Assert
      expect(contexts.map((c) => c.retryCount)).toEqual([1, 2]);
      for (const context of contexts) {
        expect(context.reason).toBe('status');
        expect(context.response?.status).toBe(500);
        expect(context.error).toBeUndefined();
        expect(context.request).toBeInstanceOf(Request);
      }
    });

    it('should pass the network discriminants', async () => {
      // Arrange
      const contexts: RetryContext[] = [];
      const thrown = new TypeError('Failed to fetch');
      fetchSpy
        .mockRejectedValueOnce(thrown)
        .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
      const client = valifetch.create({
        retry: {
          delay: () => 0,
          shouldRetry: (context) => {
            contexts.push(context);
            return true;
          },
        },
      });

      // Act
      await client.get('https://api.example.com/flaky');

      // Assert
      expect(contexts).toHaveLength(1);
      expect(contexts[0]?.reason).toBe('network');
      expect(contexts[0]?.error).toBe(thrown);
      expect(contexts[0]?.response).toBeUndefined();
      expect(contexts[0]?.request).toBeInstanceOf(Request);
    });
  });

  describe('ordering against beforeRetry', () => {
    it('should run the predicate before the beforeRetry hooks', async () => {
      // Arrange
      const calls: string[] = [];
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({}, 500))
        .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
      const client = valifetch.create({
        retry: {
          delay: () => 0,
          shouldRetry: () => {
            calls.push('predicate');
            return true;
          },
        },
        hooks: {
          beforeRetry: [
            () => {
              calls.push('beforeRetry');
            },
          ],
        },
      });

      // Act
      await client.post('https://api.example.com/items', {
        json: { name: 'a' },
      });

      // Assert
      expect(calls).toEqual(['predicate', 'beforeRetry']);
    });

    it('should skip beforeRetry entirely when the predicate refuses', async () => {
      // Arrange
      const calls: string[] = [];
      fetchSpy.mockResolvedValue(jsonResponse({}, 503));
      const client = valifetch.create({
        retry: { delay: () => 0, shouldRetry: () => false },
        hooks: {
          beforeRetry: [
            () => {
              calls.push('beforeRetry');
            },
          ],
        },
      });

      // Act
      await client.get('https://api.example.com/flaky').catch(() => undefined);

      // Assert
      expect(calls).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should still honor `stop` from beforeRetry after the predicate approves', async () => {
      // Arrange
      fetchSpy.mockResolvedValue(jsonResponse({}, 500));
      const client = valifetch.create({
        retry: { delay: () => 0, shouldRetry: () => true },
        hooks: { beforeRetry: [() => stop] },
      });

      // Act
      const error = await client
        .post('https://api.example.com/items', { json: { name: 'a' } })
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(ValifetchError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('throwing predicate', () => {
    it('should propagate the error from the status path', async () => {
      // Arrange
      const boom = new Error('predicate exploded');
      fetchSpy.mockResolvedValue(jsonResponse({}, 503));
      const client = valifetch.create({
        retry: {
          delay: () => 0,
          shouldRetry: () => {
            throw boom;
          },
        },
      });

      // Act
      const error = await client
        .get('https://api.example.com/flaky')
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBe(boom);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should propagate the error from the network path', async () => {
      // Arrange
      const boom = new Error('predicate exploded');
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
      const client = valifetch.create({
        retry: {
          delay: () => 0,
          shouldRetry: () => {
            throw boom;
          },
        },
      });

      // Act
      const error = await client
        .get('https://api.example.com/flaky')
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBe(boom);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('body-bearing requests', () => {
    it('should resend the body on a predicate-driven POST retry', async () => {
      // Arrange — real fetch consumes the request body, so the mock must too.
      const bodies: string[] = [];
      fetchSpy.mockImplementation(async (input) => {
        const req = input as Request;
        bodies.push(await req.text());
        return bodies.length === 1
          ? jsonResponse({}, 500)
          : jsonResponse({ ok: true }, 200);
      });
      const client = valifetch.create({
        retry: { delay: () => 0, shouldRetry: () => true },
      });

      // Act
      const result = await client.post('https://api.example.com/items', {
        json: { name: 'a' },
      });

      // Assert
      expect(result).toEqual({ ok: true });
      expect(bodies).toEqual(['{"name":"a"}', '{"name":"a"}']);
    });
  });

  describe('normalizeRetryOptions', () => {
    it('should keep the predicate on the object form', () => {
      // Arrange
      const predicate = () => true;

      // Act
      const normalized = normalizeRetryOptions({ shouldRetry: predicate });

      // Assert
      expect(normalized).not.toBe(false);
      expect(normalized && normalized.shouldRetry).toBe(predicate);
      expect(normalized && normalized.limit).toBe(DEFAULT_RETRY_OPTIONS.limit);
    });

    it('should leave the predicate unset for the number and default forms', () => {
      // Act
      const fromNumber = normalizeRetryOptions(5);
      const fromDefault = normalizeRetryOptions(undefined);

      // Assert
      expect(fromNumber && fromNumber.shouldRetry).toBeUndefined();
      expect(fromDefault && fromDefault.shouldRetry).toBeUndefined();
    });
  });

  describe('resolveRetryDecision', () => {
    const context: RetryContext = {
      request: new Request('https://api.example.com/x'),
      retryCount: 3,
      reason: 'network',
      error: new TypeError('Failed to fetch'),
    };

    it('should refuse once retryCount exceeds the limit', async () => {
      // Arrange
      const predicate = vi.fn(() => true);

      // Act
      const decision = await resolveRetryDecision(
        context,
        { ...DEFAULT_RETRY_OPTIONS, limit: 2, shouldRetry: predicate },
        () => true
      );

      // Assert
      expect(decision).toBe(false);
      expect(predicate).not.toHaveBeenCalled();
    });

    it('should fall back to the default decision without a predicate', async () => {
      // Act
      const decision = await resolveRetryDecision(
        { ...context, retryCount: 1 },
        DEFAULT_RETRY_OPTIONS,
        () => true
      );

      // Assert
      expect(decision).toBe(true);
    });
  });
});
