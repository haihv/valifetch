import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stop } from '../../src/core/hooks';
import { valifetch } from '../../src/core/valifetch';
import { ValifetchError } from '../../src/errors/ValifetchError';
import type { BeforeRetryHook, BeforeRetryState } from '../../src/types';

describe('hooks/beforeRetry', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const retryOptions = {
    limit: 2,
    methods: ['GET' as const],
    statusCodes: [503],
    delay: () => 0,
  };

  const mockStatus = (status: number) => {
    fetchSpy.mockResolvedValue(new Response('{}', { status }));
  };

  describe('status retries', () => {
    it('should call the hook with the failing response and a 1-based retry count', async () => {
      // Arrange
      const states: BeforeRetryState[] = [];
      mockStatus(503);
      const client = valifetch.create({
        retry: retryOptions,
        hooks: {
          beforeRetry: [
            (state) => {
              states.push(state);
            },
          ],
        },
      });

      // Act
      const error = await client
        .get('https://api.example.com/flaky')
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(ValifetchError);
      expect(states).toHaveLength(2);
      expect(states.map((s) => s.retryCount)).toEqual([1, 2]);
      for (const state of states) {
        expect(state.reason).toBe('status');
        expect(state.response?.status).toBe(503);
        expect(state.error).toBeUndefined();
        expect(state.request).toBeInstanceOf(Request);
        expect(state.options.method).toBe('GET');
      }
    });

    it('should abort retrying and throw HTTP_ERROR when the hook returns stop', async () => {
      // Arrange
      mockStatus(503);
      const client = valifetch.create({
        retry: retryOptions,
        hooks: { beforeRetry: [() => stop] },
      });

      // Act
      const error = await client
        .get('https://api.example.com/flaky')
        .catch((e: unknown) => e);

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('HTTP_ERROR');
    });

    it('should return the failing response when the hook returns stop and http errors are not thrown', async () => {
      // Arrange
      mockStatus(503);
      const client = valifetch.create({
        retry: retryOptions,
        throwHttpErrors: false,
        hooks: { beforeRetry: [() => stop] },
      });

      // Act
      const response = await client.get<Response>(
        'https://api.example.com/flaky',
        { responseType: 'raw' }
      );

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(503);
    });

    it('should send the replacement request returned by the hook', async () => {
      // Arrange
      let callCount = 0;
      fetchSpy.mockImplementation(() => {
        callCount++;
        return Promise.resolve(
          callCount === 1
            ? new Response('{}', { status: 503 })
            : new Response('{"ok":true}', { status: 200 })
        );
      });
      const client = valifetch.create({
        retry: retryOptions,
        hooks: {
          beforeRetry: [
            (state) =>
              new Request(state.request, { headers: { 'x-retry': '1' } }),
          ],
        },
      });

      // Act
      const result = await client.get('https://api.example.com/flaky');

      // Assert
      expect(result).toEqual({ ok: true });
      expect(callCount).toBe(2);
      const secondRequest = fetchSpy.mock.calls[1]?.[0] as Request;
      expect(secondRequest.headers.get('x-retry')).toBe('1');
    });
  });

  describe('network retries', () => {
    const networkError = new TypeError('Failed to fetch');

    it('should call the hook with the thrown network error', async () => {
      // Arrange
      const states: BeforeRetryState[] = [];
      fetchSpy.mockRejectedValue(networkError);
      const client = valifetch.create({
        retry: retryOptions,
        hooks: {
          beforeRetry: [
            (state) => {
              states.push(state);
            },
          ],
        },
      });

      // Act
      const error = await client
        .get('https://api.example.com/flaky')
        .catch((e: unknown) => e);

      // Assert
      expect((error as ValifetchError).code).toBe('NETWORK_ERROR');
      expect(states).toHaveLength(2);
      expect(states[0]?.reason).toBe('network');
      expect(states[0]?.error).toBe(networkError);
      expect(states[0]?.response).toBeUndefined();
    });

    it('should abort retrying and throw NETWORK_ERROR when the hook returns stop', async () => {
      // Arrange
      fetchSpy.mockRejectedValue(networkError);
      const client = valifetch.create({
        retry: retryOptions,
        hooks: { beforeRetry: [() => stop] },
      });

      // Act
      const error = await client
        .get('https://api.example.com/flaky')
        .catch((e: unknown) => e);

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect((error as ValifetchError).code).toBe('NETWORK_ERROR');
      expect((error as ValifetchError).cause).toBe(networkError);
    });

    it('should send the replacement request returned by the hook', async () => {
      // Arrange
      let callCount = 0;
      fetchSpy.mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? Promise.reject(networkError)
          : Promise.resolve(new Response('{"ok":true}', { status: 200 }));
      });
      const client = valifetch.create({
        retry: retryOptions,
        hooks: {
          beforeRetry: [
            (state) =>
              new Request(state.request, { headers: { 'x-retry': '1' } }),
          ],
        },
      });

      // Act
      const result = await client.get('https://api.example.com/flaky');

      // Assert
      expect(result).toEqual({ ok: true });
      const secondRequest = fetchSpy.mock.calls[1]?.[0] as Request;
      expect(secondRequest.headers.get('x-retry')).toBe('1');
    });
  });

  describe('hook merging', () => {
    const track = (calls: string[], name: string): BeforeRetryHook => {
      return () => {
        calls.push(name);
      };
    };

    it('should run instance hooks before per-request hooks', async () => {
      // Arrange
      const calls: string[] = [];
      mockStatus(503);
      const client = valifetch.create({
        retry: { ...retryOptions, limit: 1 },
        hooks: { beforeRetry: [track(calls, 'instance')] },
      });

      // Act
      await client
        .get('https://api.example.com/flaky', {
          hooks: { beforeRetry: [track(calls, 'request')] },
        })
        .catch(() => undefined);

      // Assert
      expect(calls).toEqual(['instance', 'request']);
    });

    it('should keep the per-request hook when only the request side defines beforeRetry', async () => {
      // Arrange
      const calls: string[] = [];
      mockStatus(503);
      const client = valifetch.create({
        retry: { ...retryOptions, limit: 1 },
        hooks: { beforeRequest: [() => undefined] },
      });

      // Act
      await client
        .get('https://api.example.com/flaky', {
          hooks: { beforeRetry: [track(calls, 'request')] },
        })
        .catch(() => undefined);

      // Assert
      expect(calls).toEqual(['request']);
    });

    it('should keep the instance hook when only the instance side defines beforeRetry', async () => {
      // Arrange
      const calls: string[] = [];
      mockStatus(503);
      const client = valifetch.create({
        retry: { ...retryOptions, limit: 1 },
        hooks: { beforeRetry: [track(calls, 'instance')] },
      });

      // Act
      await client
        .get('https://api.example.com/flaky', {
          hooks: { beforeRequest: [() => undefined] },
        })
        .catch(() => undefined);

      // Assert
      expect(calls).toEqual(['instance']);
    });

    it('should run parent hooks before extended child hooks', async () => {
      // Arrange
      const calls: string[] = [];
      mockStatus(503);
      const parent = valifetch.create({
        retry: { ...retryOptions, limit: 1 },
        hooks: { beforeRetry: [track(calls, 'parent')] },
      });
      const child = parent.extend({
        hooks: { beforeRetry: [track(calls, 'child')] },
      });

      // Act
      await child.get('https://api.example.com/flaky').catch(() => undefined);

      // Assert
      expect(calls).toEqual(['parent', 'child']);
    });

    it('should inherit the parent hook when the child defines other hooks only', async () => {
      // Arrange
      const calls: string[] = [];
      mockStatus(503);
      const parent = valifetch.create({
        retry: { ...retryOptions, limit: 1 },
        hooks: { beforeRetry: [track(calls, 'parent')] },
      });
      const child = parent.extend({
        hooks: { beforeRequest: [() => undefined] },
      });

      // Act
      await child.get('https://api.example.com/flaky').catch(() => undefined);

      // Assert
      expect(calls).toEqual(['parent']);
    });

    it('should use the child hook when the parent defines other hooks only', async () => {
      // Arrange
      const calls: string[] = [];
      mockStatus(503);
      const parent = valifetch.create({
        retry: { ...retryOptions, limit: 1 },
        hooks: { beforeRequest: [() => undefined] },
      });
      const child = parent.extend({
        hooks: { beforeRetry: [track(calls, 'child')] },
      });

      // Act
      await child.get('https://api.example.com/flaky').catch(() => undefined);

      // Assert
      expect(calls).toEqual(['child']);
    });
  });

  describe('requests with a body', () => {
    const putRetryOptions = {
      limit: 1,
      methods: ['PUT' as const],
      statusCodes: [503],
      delay: () => 0,
    };

    // Real fetch consumes the request body, which is what makes the sent
    // request unusable for a later clone — the mock must do the same.
    const mockConsumingFetch = (bodies: string[], headers?: Headers[]) => {
      fetchSpy.mockImplementation(async (input) => {
        const req = input as Request;
        headers?.push(new Headers(req.headers));
        bodies.push(await req.text());
        return bodies.length === 1
          ? new Response('{}', { status: 503 })
          : new Response('{"ok":true}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
      });
    };

    it('should retry and resend the body when the first attempt fails', async () => {
      // Arrange
      const bodies: string[] = [];
      mockConsumingFetch(bodies);
      const client = valifetch.create({ retry: putRetryOptions });

      // Act
      const result = await client.put('https://api.example.com/items/1', {
        json: { name: 'updated' },
      });

      // Assert
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(bodies).toEqual(['{"name":"updated"}', '{"name":"updated"}']);
    });

    it('should let the hook build a replacement request from the failed one', async () => {
      // Arrange
      const bodies: string[] = [];
      const headers: Headers[] = [];
      mockConsumingFetch(bodies, headers);
      const client = valifetch.create({
        retry: putRetryOptions,
        hooks: {
          beforeRetry: [
            ({ request, retryCount }) =>
              new Request(request, {
                headers: {
                  ...Object.fromEntries(request.headers),
                  'x-retry-attempt': String(retryCount),
                },
              }),
          ],
        },
      });

      // Act
      await client.put('https://api.example.com/items/1', {
        json: { name: 'updated' },
      });

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(headers[1]?.get('x-retry-attempt')).toBe('1');
      expect(bodies[1]).toBe('{"name":"updated"}');
    });
  });

  describe('when the hook throws', () => {
    it('should surface the hook error unchanged on the status path', async () => {
      // Arrange
      const hookError = new Error('hook exploded');
      let hookCalls = 0;
      mockStatus(503);
      const client = valifetch.create({
        retry: retryOptions,
        hooks: {
          beforeRetry: [
            () => {
              hookCalls++;
              throw hookError;
            },
          ],
        },
      });

      // Act
      const error = await client
        .get('https://api.example.com/flaky')
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBe(hookError);
      expect(error).not.toBeInstanceOf(ValifetchError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(hookCalls).toBe(1);
    });
  });

  describe('debug events', () => {
    it('should report the failed request on the network retry event', async () => {
      // Arrange
      const events: { type: string; request?: Request }[] = [];
      let call = 0;
      fetchSpy.mockImplementation(() => {
        call++;
        return call === 1
          ? Promise.reject(new TypeError('fetch failed'))
          : Promise.resolve(
              new Response('{}', {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            );
      });
      const client = valifetch.create({
        retry: {
          limit: 1,
          methods: ['GET'],
          statusCodes: [503],
          delay: () => 0,
        },
        debug: (event) =>
          events.push(event as { type: string; request?: Request }),
        headers: { 'x-original': 'yes' },
        hooks: {
          beforeRetry: [
            ({ request }) =>
              new Request(request.url, { method: 'GET', headers: {} }),
          ],
        },
      });

      // Act
      await client.get('https://api.example.com/flaky');

      // Assert
      const retryEvent = events.find((e) => e.type === 'retry');
      expect(retryEvent?.request?.headers.get('x-original')).toBe('yes');
    });
  });

  describe('the stop sentinel', () => {
    it('should be registered in the global symbol registry', () => {
      // A plain Symbol() would yield two distinct values across the CJS/ESM builds
      expect(stop).toBe(Symbol.for('valifetch.stop'));
    });
  });
});
