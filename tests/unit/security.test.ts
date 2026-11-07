import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { basicAuth, bearerAuth, jwtRefresh } from '../../src/auth';
import { MAX_SSE_EVENT_SIZE, parseSSEResponse } from '../../src/core/response';
import {
  DEFAULT_RETRY_OPTIONS,
  getRetryAfterDelay,
  MAX_TIMER_DELAY,
  normalizeRetryOptions,
  sleep,
} from '../../src/core/retry';
import { valifetch } from '../../src/core/valifetch';
import { ValifetchError } from '../../src/errors/ValifetchError';
import { createMock } from '../../src/mock';
import type { ValifetchInstanceOptions } from '../../src/types';
import { buildUrl } from '../../src/url/builder';
import { replacePathParams } from '../../src/url/params';

const BASE = 'https://api.example.com';

const jsonResponse = (body: unknown = { ok: true }): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('security', () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  const sentRequest = (index = 0): Request =>
    fetchSpy.mock.calls[index][0] as Request;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockImplementation(() => Promise.resolve(jsonResponse()));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('prototype pollution', () => {
    const polluted = (): ValifetchInstanceOptions =>
      JSON.parse(
        '{"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}}'
      ) as ValifetchInstanceOptions;

    it('extend() with a JSON-derived __proto__ key does not swap the merged options prototype', async () => {
      let merged: ValifetchInstanceOptions | undefined;
      const child = valifetch.create({ prefixUrl: BASE }).extend(polluted());
      child.extend((prev) => {
        merged = prev;
        return prev;
      });

      expect(merged).toBeDefined();
      expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
      expect((merged as Record<string, unknown>).polluted).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();

      await child.get('/users');
      expect(sentRequest().url).toBe(`${BASE}/users`);
    });

    it('header merging keeps a __proto__ header as a plain own key without touching prototypes', async () => {
      const headers = JSON.parse(
        '{"__proto__": {"polluted": true}, "x-id": "1"}'
      ) as Record<string, string>;
      let merged: Record<string, unknown> | undefined;
      const api = valifetch
        .create({ prefixUrl: BASE, headers })
        .extend({ headers: { 'x-child': '2' } });
      api.extend((prev) => {
        merged = prev.headers as Record<string, unknown>;
        return prev;
      });

      expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
      expect(Object.hasOwn(merged as object, '__proto__')).toBe(true);
      expect(merged?.polluted).toBeUndefined();

      await api.get('/users');

      const sent = sentRequest().headers;
      expect(sent.get('x-id')).toBe('1');
      expect(sent.get('x-child')).toBe('2');
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('searchParams records with prototype keys are sent as ordinary params', async () => {
      const searchParams = JSON.parse(
        '{"__proto__": "a", "constructor": "b"}'
      ) as Record<string, string>;
      const api = valifetch.create({ prefixUrl: BASE, searchParams });

      await api.get('/users', { searchParams: { page: 1 } });

      const url = new URL(sentRequest().url);
      expect(url.searchParams.get('__proto__')).toBe('a');
      expect(url.searchParams.get('constructor')).toBe('b');
      expect(url.searchParams.get('page')).toBe('1');
    });

    it('path params ignore inherited Object.prototype members', () => {
      expect(() => replacePathParams('/a/:constructor', {})).toThrow(
        'Missing required path parameter: constructor'
      );
      expect(() => replacePathParams('/a/:toString', {})).toThrow(
        'Missing required path parameter: toString'
      );
    });

    it('path params with an own __proto__ key are still resolved', () => {
      const params = JSON.parse('{"__proto__": "x"}') as Record<string, string>;
      expect(replacePathParams('/a/:__proto__', params)).toBe('/a/x');
    });
  });

  describe('prefixUrl containment', () => {
    const escaping = [
      '../admin',
      '/../admin',
      '/users/../../admin',
      '/%2e%2e/admin',
      '/.%2E/admin',
      '/%2E./admin',
    ];

    it.each(escaping)('rejects %s escaping the prefix path', (path) => {
      expect(() =>
        buildUrl({ prefixUrl: 'https://api.example.com/v1', path })
      ).toThrow(TypeError);
    });

    it('rejects escaping a prefix that ends with a slash', () => {
      expect(() =>
        buildUrl({ prefixUrl: 'https://api.example.com/v1/', path: '/../v10' })
      ).toThrow(TypeError);
    });

    it('a request against an escaping path rejects without calling fetch', async () => {
      const api = valifetch.create({ prefixUrl: `${BASE}/v1` });

      await expect(api.get('/../admin')).rejects.toThrow(TypeError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    const sameOrigin: [string, string][] = [
      ['https://evil.com', `${BASE}/v1/https://evil.com`],
      ['//evil.com', `${BASE}/v1//evil.com`],
      ['\\\\evil.com', `${BASE}/v1///evil.com`],
      ['/\\evil.com', `${BASE}/v1//evil.com`],
      ['http:evil.com', `${BASE}/v1/http:evil.com`],
      ['%2F%2Fevil.com', `${BASE}/v1/%2F%2Fevil.com`],
      ['@evil.com', `${BASE}/v1/@evil.com`],
      ['/users/../posts', `${BASE}/v1/posts`],
      ['', `${BASE}/v1/`],
      ['?q=1', `${BASE}/v1/?q=1`],
    ];

    it.each(sameOrigin)('keeps %s on the prefix origin', (path, expected) => {
      const url = buildUrl({ prefixUrl: `${BASE}/v1`, path });
      expect(url.origin).toBe(BASE);
      expect(url.href).toBe(expected);
    });

    it('allows a root prefix', () => {
      expect(buildUrl({ prefixUrl: BASE, path: '/users' }).href).toBe(
        `${BASE}/users`
      );
      expect(buildUrl({ prefixUrl: `${BASE}/`, path: 'users' }).href).toBe(
        `${BASE}/users`
      );
    });
  });

  describe('path param encoding', () => {
    it.each(['..', '.'])(
      'rejects the dot segment %s as a param value',
      (id) => {
        expect(() => replacePathParams('/users/:id/profile', { id })).toThrow(
          TypeError
        );
      }
    );

    it('rejects a dot-segment param even without a prefixUrl', async () => {
      await expect(
        valifetch.get(`${BASE}/users/:id/profile`, { params: { id: '..' } })
      ).rejects.toThrow(TypeError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['../admin', '/users/..%2Fadmin'],
      ['a/b', '/users/a%2Fb'],
      ['a?b#c', '/users/a%3Fb%23c'],
      ['\\evil', '/users/%5Cevil'],
      ['%2e%2e', '/users/%252e%252e'],
      ['...', '/users/...'],
    ])('percent-encodes %s', (id, expected) => {
      expect(replacePathParams('/users/:id', { id })).toBe(expected);
    });

    it('encoded param values never change the host or query', () => {
      const url = buildUrl({
        prefixUrl: BASE,
        path: '/users/:id',
        params: { id: '//evil.com?admin=1#x' },
      });
      expect(url.origin).toBe(BASE);
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
    });

    it('search param values are encoded and cannot inject extra params', () => {
      const url = buildUrl({
        prefixUrl: BASE,
        path: '/search',
        searchParams: { q: 'a&admin=1#frag' },
      });
      expect(url.searchParams.get('q')).toBe('a&admin=1#frag');
      expect(url.searchParams.get('admin')).toBeNull();
      expect(url.hash).toBe('');
    });
  });

  describe('header injection', () => {
    it.each(['a\r\nX-Injected: 1', 'a\nb', 'a\rb', 'a\0b'])(
      'rejects a control character in a header value (%j)',
      async (value) => {
        await expect(
          valifetch.get(`${BASE}/users`, { headers: { 'x-test': value } })
        ).rejects.toThrow(TypeError);
        expect(fetchSpy).not.toHaveBeenCalled();
      }
    );

    it('rejects CRLF in a merged instance header', async () => {
      const api = valifetch
        .create({ headers: { 'x-a': 'ok' } })
        .extend({ headers: { 'x-b': 'bad\r\nX-Injected: 1' } });

      await expect(api.get(`${BASE}/users`)).rejects.toThrow(TypeError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects CRLF in a header name', async () => {
      await expect(
        valifetch.get(`${BASE}/users`, { headers: { 'x\r\ny': '1' } })
      ).rejects.toThrow(TypeError);
    });

    it('bearerAuth rejects a token carrying CRLF', async () => {
      const api = valifetch.create({
        hooks: { beforeRequest: [bearerAuth(() => 't\r\nX-Injected: 1')] },
      });

      await expect(api.get(`${BASE}/users`)).rejects.toThrow(TypeError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('jwtRefresh rejects a refreshed token carrying CRLF', async () => {
      const api = valifetch.create({
        hooks: {
          beforeRequest: [
            jwtRefresh({
              getToken: () => null,
              isExpired: () => true,
              refresh: async () => 't\r\nX-Injected: 1',
            }),
          ],
        },
      });

      await expect(api.get(`${BASE}/users`)).rejects.toThrow(TypeError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('basicAuth base64-encodes CRLF so it cannot split the header', async () => {
      const api = valifetch.create({
        hooks: { beforeRequest: [basicAuth('u\r\nX-Injected: 1', 'p')] },
      });

      await api.get(`${BASE}/users`);

      const header = sentRequest().headers.get('authorization') as string;
      expect(header).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
      expect(sentRequest().headers.get('x-injected')).toBeNull();
    });

    it('request-level headers override instance headers case-insensitively', async () => {
      const api = valifetch.create({
        headers: { Authorization: 'Bearer instance' },
      });

      await api.get(`${BASE}/users`, {
        headers: { authorization: 'Bearer request' },
      });

      expect(sentRequest().headers.get('authorization')).toBe('Bearer request');
    });
  });

  describe('credential leakage', () => {
    it('debug: true never prints sensitive headers to the console', async () => {
      const consoleSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);
      fetchSpy.mockResolvedValueOnce(
        new Response('{}', {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'sid=server-secret',
          },
        })
      );
      const api = valifetch.create({
        debug: true,
        headers: {
          cookie: 'sid=cookie-secret',
          'x-api-key': 'key-secret',
          'proxy-authorization': 'Basic proxy-secret',
          'x-trace': 'visible',
        },
        hooks: { beforeRequest: [bearerAuth(() => 'token-secret')] },
      });

      await api.get(`${BASE}/users`);

      const printed = JSON.stringify(consoleSpy.mock.calls);
      for (const secret of [
        'token-secret',
        'cookie-secret',
        'key-secret',
        'proxy-secret',
        'server-secret',
      ]) {
        expect(printed).not.toContain(secret);
      }
      expect(consoleSpy.mock.calls[0][1]).toMatchObject({
        type: 'request',
        method: 'GET',
        url: `${BASE}/users`,
        headers: { authorization: '[REDACTED]', 'x-trace': 'visible' },
      });
      expect(consoleSpy.mock.calls[1][1]).toMatchObject({
        type: 'response',
        status: 200,
        attempt: 1,
        responseHeaders: { 'set-cookie': '[REDACTED]' },
      });
    });

    it('debug: true logs retry and cancel summaries without headers leaking', async () => {
      vi.useFakeTimers();
      const consoleSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);
      fetchSpy
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockImplementationOnce(
          (_input, init) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError'))
              );
            })
        );
      const api = valifetch.create({
        debug: true,
        retry: { limit: 1, delay: () => 10 },
        hooks: { beforeRequest: [bearerAuth(() => 'token-secret')] },
      });

      const promise = api.get(`${BASE}/users`);
      const settled = promise.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(10);
      promise.cancel();
      const error = await settled;

      expect(error).toBeInstanceOf(ValifetchError);
      const events = consoleSpy.mock.calls.map((call) => call[1]);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'retry',
          attempt: 1,
          delay: 10,
          reason: 'status',
        })
      );
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'cancel', url: `${BASE}/users` })
      );
      expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain(
        'token-secret'
      );
    });

    it('a custom debug function still receives the live Request', async () => {
      const seen: Request[] = [];
      const api = valifetch.create({
        debug: (event) => {
          seen.push(event.request);
        },
        hooks: { beforeRequest: [bearerAuth(() => 'token')] },
      });

      await api.get(`${BASE}/users`);

      expect(seen[0]).toBeInstanceOf(Request);
      expect(seen[0].headers.get('authorization')).toBe('Bearer token');
    });

    it('ValifetchError serialization and message never include request headers', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('{"error":"nope"}', { status: 401 })
      );
      const api = valifetch.create({
        hooks: { beforeRequest: [bearerAuth(() => 'token-secret')] },
      });

      const error = (await api
        .get(`${BASE}/users`)
        .catch((e: unknown) => e)) as ValifetchError;

      expect(error).toBeInstanceOf(ValifetchError);
      expect(error.message).not.toContain('token-secret');
      expect(JSON.stringify(error)).not.toContain('token-secret');
      expect(String(error)).not.toContain('token-secret');
    });

    it('retries resend to the same URL as the original request', async () => {
      fetchSpy
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockResolvedValueOnce(jsonResponse());
      const api = valifetch.create({
        prefixUrl: BASE,
        retry: { limit: 1, delay: () => 0 },
        hooks: { beforeRequest: [bearerAuth(() => 'token')] },
      });

      await api.get('/users');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(sentRequest(1).url).toBe(sentRequest(0).url);
    });
  });

  describe('untrusted response parsing', () => {
    const streamOf = (chunks: string[]): ReadableStream<Uint8Array> =>
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        },
      });

    it('aborts an SSE stream whose pending event exceeds the size cap', async () => {
      let cancelled = false;
      const chunk = 'x'.repeat(1024);
      let pulls = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls++;
          controller.enqueue(
            new TextEncoder().encode(pulls === 1 ? 'data: ' : chunk)
          );
        },
        cancel() {
          cancelled = true;
        },
      });

      const consume = async (): Promise<void> => {
        for await (const _event of parseSSEResponse(body, 64 * 1024)) {
          // never reached: no event boundary is ever sent
        }
      };

      const error = (await consume().catch(
        (e: unknown) => e
      )) as ValifetchError;
      expect(error).toBeInstanceOf(ValifetchError);
      expect(error.code).toBe('PARSE_ERROR');
      expect(cancelled).toBe(true);
      expect(pulls).toBeLessThan(200);
    });

    it('the per-call sseMaxEventSize applies through the request pipeline', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(streamOf(['data: ', 'x'.repeat(2048)]), {
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const events = await valifetch.get<AsyncIterable<MessageEvent>>(
        `${BASE}/events`,
        { responseType: 'sse', sseMaxEventSize: 1024 }
      );
      const consume = async (): Promise<void> => {
        for await (const _event of events) {
          // never reached
        }
      };

      const error = (await consume().catch(
        (e: unknown) => e
      )) as ValifetchError;
      expect(error).toBeInstanceOf(ValifetchError);
      expect(error.code).toBe('PARSE_ERROR');
      expect(error.message).toContain('1024');
      expect(error.request?.url).toBe(`${BASE}/events`);
      expect(error.response?.status).toBe(200);
    });

    it('events below the SSE cap still parse across many chunks', async () => {
      const payload = 'y'.repeat(10_000);
      const chunks = ['data: ', ...payload.match(/.{1,100}/g)!, '\n\n'];
      const events: MessageEvent[] = [];
      for await (const event of parseSSEResponse(streamOf(chunks), 20_000)) {
        events.push(event);
      }
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe(payload);
    });

    it('a CRLF split across chunks is one line ending, not an event boundary', async () => {
      const events: MessageEvent[] = [];
      for await (const event of parseSSEResponse(
        streamOf(['data: a\r', '\ndata: b\r\n\r\n'])
      )) {
        events.push(event);
      }
      expect(events.map((e) => e.data)).toEqual(['a\nb']);
    });

    it('a trailing CR at end of stream still terminates the last line', async () => {
      const events: MessageEvent[] = [];
      for await (const event of parseSSEResponse(streamOf(['data: a\r']))) {
        events.push(event);
      }
      expect(events.map((e) => e.data)).toEqual(['a']);
    });

    it('sleep clamps delays beyond the timer range instead of firing immediately', async () => {
      vi.useFakeTimers();
      let done = false;
      void sleep(Number.MAX_SAFE_INTEGER).then(() => {
        done = true;
      });

      await vi.advanceTimersByTimeAsync(1_000);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(MAX_TIMER_DELAY);
      expect(done).toBe(true);
    });
  });
  describe('Retry-After above maxRetryAfter', () => {
    const tooLong = (value = '120'): Response =>
      new Response('', { status: 429, headers: { 'retry-after': value } });

    it('does not retry early; the HTTP error goes through beforeError', async () => {
      vi.useFakeTimers();
      fetchSpy
        .mockResolvedValueOnce(tooLong())
        .mockResolvedValueOnce(jsonResponse());
      const beforeRetry = vi.fn();
      const beforeError = vi.fn((error: ValifetchError) => error);
      const debug = vi.fn();
      const shouldRetry = vi.fn(() => undefined);

      const promise = valifetch
        .get(`${BASE}/users`, {
          retry: { limit: 1, maxRetryAfter: 50, shouldRetry },
          hooks: { beforeRetry: [beforeRetry], beforeError: [beforeError] },
          debug,
        })
        .catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(200);
      const error = (await promise) as ValifetchError;

      expect(error).toBeInstanceOf(ValifetchError);
      expect(error.code).toBe('HTTP_ERROR');
      expect(error.status).toBe(429);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
      expect(beforeRetry).not.toHaveBeenCalled();
      expect(beforeError).toHaveBeenCalledTimes(1);
      expect(debug.mock.calls.map(([event]) => event.type)).not.toContain(
        'retry'
      );
    });

    it('applies the 60 s default cap', async () => {
      fetchSpy
        .mockResolvedValueOnce(tooLong('61'))
        .mockResolvedValueOnce(jsonResponse());

      const error = (await valifetch
        .get(`${BASE}/users`, { retry: 1 })
        .catch((e: unknown) => e)) as ValifetchError;

      expect(error.code).toBe('HTTP_ERROR');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns the response as-is with throwHttpErrors: false', async () => {
      fetchSpy.mockResolvedValueOnce(tooLong());

      const response = await valifetch.get<Response>(`${BASE}/users`, {
        retry: 1,
        throwHttpErrors: false,
        responseType: 'raw',
      });

      expect(response.status).toBe(429);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('waits the full Retry-After when it is within the cap', async () => {
      vi.useFakeTimers();
      fetchSpy
        .mockResolvedValueOnce(tooLong('120'))
        .mockResolvedValueOnce(jsonResponse());

      const promise = valifetch.get(`${BASE}/users`, {
        retry: { limit: 1, maxRetryAfter: 120_000 },
      });
      await vi.advanceTimersByTimeAsync(119_999);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('Infinity honours any Retry-After', async () => {
      vi.useFakeTimers();
      fetchSpy
        .mockResolvedValueOnce(tooLong('999999'))
        .mockResolvedValueOnce(jsonResponse());

      const promise = valifetch.get(`${BASE}/users`, {
        retry: { limit: 1, maxRetryAfter: Number.POSITIVE_INFINITY },
      });
      await vi.advanceTimersByTimeAsync(999_999_000);

      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['NaN', Number.NaN],
      ['negative', -1],
      ['non-number', '5000' as unknown as number],
    ])('a %s maxRetryAfter falls back to the 60 s default', (_label, value) => {
      const normalized = normalizeRetryOptions({ maxRetryAfter: value });
      expect(normalized).not.toBe(false);
      expect((normalized as { maxRetryAfter: number }).maxRetryAfter).toBe(
        DEFAULT_RETRY_OPTIONS.maxRetryAfter
      );
    });

    it('a NaN maxRetryAfter still retries a short Retry-After', async () => {
      vi.useFakeTimers();
      fetchSpy
        .mockResolvedValueOnce(tooLong('1'))
        .mockResolvedValueOnce(jsonResponse());

      const promise = valifetch.get(`${BASE}/users`, {
        retry: { limit: 1, maxRetryAfter: Number.NaN },
      });
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(promise).resolves.toEqual({ ok: true });
    });

    it('getRetryAfterDelay returns the raw far-future delay unclamped', () => {
      const response = new Response('', {
        headers: { 'retry-after': 'Fri, 31 Dec 9999 23:59:59 GMT' },
      });
      expect(getRetryAfterDelay(response)).toBeGreaterThan(1e14);
    });
  });

  describe('strict Retry-After parsing', () => {
    const delayOf = (value: string): number | null =>
      getRetryAfterDelay(
        new Response('', { headers: { 'retry-after': value } })
      );

    it.each(['1.5', '1e9', '0x10', ' 5abc', '-1', '', '+5'])(
      'ignores the malformed value %j',
      (value) => {
        expect(delayOf(value)).toBeNull();
      }
    );

    it('accepts digits surrounded by whitespace', () => {
      expect(delayOf(' 7 ')).toBe(7_000);
    });

    it('falls back to normal backoff for a malformed value', async () => {
      vi.useFakeTimers();
      fetchSpy
        .mockResolvedValueOnce(
          new Response('', { status: 503, headers: { 'retry-after': '1e9' } })
        )
        .mockResolvedValueOnce(jsonResponse());

      const promise = valifetch.get(`${BASE}/users`, {
        retry: { limit: 1, delay: () => 10 },
      });
      await vi.advanceTimersByTimeAsync(10);

      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('sleep input clamping', () => {
    it.each([
      ['NaN', Number.NaN],
      ['negative', -500],
    ])('treats a %s delay as 0', async (_label, ms) => {
      vi.useFakeTimers();
      let done = false;
      void sleep(ms).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(done).toBe(true);
    });
  });

  describe('SSE line endings and cancellation', () => {
    const encoder = new TextEncoder();

    // Enqueues each chunk on demand, then never closes: models a live stream
    // that pauses after the given chunks.
    const pausedStream = (
      chunks: string[],
      onCancel?: () => void
    ): ReadableStream<Uint8Array> => {
      let index = 0;
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (index < chunks.length) {
            controller.enqueue(encoder.encode(chunks[index++]));
            return undefined;
          }
          // Out of chunks: stay pending forever (no enqueue, no close).
          return new Promise<void>(() => undefined);
        },
        cancel() {
          onCancel?.();
        },
      });
    };

    const closedStream = (chunks: string[]): ReadableStream<Uint8Array> =>
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      });

    const collect = async (
      body: ReadableStream<Uint8Array>
    ): Promise<string[]> => {
      const data: string[] = [];
      for await (const event of parseSSEResponse(body)) data.push(event.data);
      return data;
    };

    it('yields a CR-terminated event immediately when the stream pauses', async () => {
      const iterator = parseSSEResponse(pausedStream(['data: a\r\r']))[
        Symbol.asyncIterator
      ]();
      const first = await Promise.race([
        iterator.next(),
        new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), 200)
        ),
      ]);
      expect(first).not.toBe('timeout');
      expect((first as IteratorResult<MessageEvent>).value.data).toBe('a');
      await iterator.return?.();
    });

    it('a CR then LF+CRLF split across chunks is one event boundary', async () => {
      expect(await collect(closedStream(['data: a\r', '\n\r\n']))).toEqual([
        'a',
      ]);
    });

    it('a CR followed by a non-LF chunk starts a new line', async () => {
      expect(await collect(closedStream(['data: a\r', 'data: b\n\n']))).toEqual(
        ['a\nb']
      );
    });

    it('a chunk that is only the LF of a split CRLF is dropped', async () => {
      expect(
        await collect(closedStream(['data: a\r', '\n', 'data: b\n\n']))
      ).toEqual(['a\nb']);
    });

    it('a CR as the last byte of the stream terminates the final event', async () => {
      expect(await collect(closedStream(['data: a\r']))).toEqual(['a']);
    });

    it('breaking out of the loop cancels the source stream', async () => {
      let cancelled = false;
      const body = pausedStream(['data: a\n\n', 'data: b\n\n'], () => {
        cancelled = true;
      });

      for await (const _event of parseSSEResponse(body)) {
        break;
      }

      expect(cancelled).toBe(true);
    });

    it('breaking out through the request pipeline cancels the response body', async () => {
      let cancelled = false;
      fetchSpy.mockResolvedValueOnce(
        new Response(
          pausedStream(['data: a\n\n'], () => {
            cancelled = true;
          }),
          { headers: { 'content-type': 'text/event-stream' } }
        )
      );

      const events = await valifetch.get<AsyncIterable<MessageEvent>>(
        `${BASE}/events`,
        { responseType: 'sse' }
      );
      for await (const _event of events) {
        break;
      }

      expect(cancelled).toBe(true);
    });

    it('a read error propagates and the failed cancel is swallowed', async () => {
      const failure = new Error('connection reset');
      let pulls = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls++;
          if (pulls === 1) controller.enqueue(encoder.encode('data: a'));
          else controller.error(failure);
        },
      });

      await expect(collect(body)).rejects.toBe(failure);
    });
  });

  describe('sseMaxEventSize option', () => {
    const sseResponse = (size: number): Response =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            // Small chunks so the pending event grows past the cap before
            // its boundary arrives.
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('data: '));
            for (let sent = 0; sent < size; sent += 512) {
              controller.enqueue(
                encoder.encode('x'.repeat(Math.min(512, size - sent)))
              );
            }
            controller.enqueue(encoder.encode('\n\n'));
            controller.close();
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      );

    const consume = async (
      events: AsyncIterable<MessageEvent>
    ): Promise<unknown> => {
      try {
        const data: string[] = [];
        for await (const event of events) data.push(event.data);
        return data;
      } catch (error) {
        return error;
      }
    };

    it('defaults to 16 MiB so a multi-MiB event still parses', async () => {
      expect(MAX_SSE_EVENT_SIZE).toBe(16 * 1024 * 1024);
      fetchSpy.mockResolvedValueOnce(sseResponse(2 * 1024 * 1024));

      const events = await valifetch.get<AsyncIterable<MessageEvent>>(
        `${BASE}/events`,
        { responseType: 'sse' }
      );
      const result = (await consume(events)) as string[];

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2 * 1024 * 1024);
    });

    it('applies an instance-level cap', async () => {
      fetchSpy.mockResolvedValueOnce(sseResponse(4096));
      const api = valifetch.create({ prefixUrl: BASE, sseMaxEventSize: 1024 });

      const events = await api.get<AsyncIterable<MessageEvent>>('/events', {
        responseType: 'sse',
      });
      const error = (await consume(events)) as ValifetchError;

      expect(error).toBeInstanceOf(ValifetchError);
      expect(error.code).toBe('PARSE_ERROR');
    });

    it('carries the cap through extend()', async () => {
      fetchSpy.mockResolvedValueOnce(sseResponse(4096));
      const api = valifetch
        .create({ prefixUrl: BASE })
        .extend({ sseMaxEventSize: 1024 });

      const events = await api.get<AsyncIterable<MessageEvent>>('/events', {
        responseType: 'sse',
      });

      expect(((await consume(events)) as ValifetchError).code).toBe(
        'PARSE_ERROR'
      );
    });

    it('lets a per-call value win over the instance value', async () => {
      fetchSpy.mockResolvedValueOnce(sseResponse(4096));
      const api = valifetch.create({ prefixUrl: BASE, sseMaxEventSize: 1024 });

      const events = await api.get<AsyncIterable<MessageEvent>>('/events', {
        responseType: 'sse',
        sseMaxEventSize: 8192,
      });

      expect(await consume(events)).toEqual(['x'.repeat(4096)]);
    });

    it('Infinity disables the cap', async () => {
      fetchSpy.mockResolvedValueOnce(sseResponse(4096));

      const events = await valifetch.get<AsyncIterable<MessageEvent>>(
        `${BASE}/events`,
        { responseType: 'sse', sseMaxEventSize: Number.POSITIVE_INFINITY }
      );

      expect(await consume(events)).toEqual(['x'.repeat(4096)]);
    });

    it.each([
      ['NaN', Number.NaN],
      ['negative', -1],
      ['non-number', '1' as unknown as number],
    ])('a %s value falls back to the default cap', async (_label, value) => {
      fetchSpy.mockResolvedValueOnce(sseResponse(4096));

      const events = await valifetch.get<AsyncIterable<MessageEvent>>(
        `${BASE}/events`,
        { responseType: 'sse', sseMaxEventSize: value }
      );

      expect(await consume(events)).toEqual(['x'.repeat(4096)]);
    });
  });

  describe('debug URL redaction', () => {
    it('redacts sensitive query parameter values but keeps the rest', async () => {
      const consoleSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);

      await valifetch.get(
        `${BASE}/files?access_token=SECRET1&X-Amz-Signature=SECRET2&code=SECRET3&page=2`,
        { debug: true }
      );

      const printed = JSON.stringify(consoleSpy.mock.calls);
      for (const secret of ['SECRET1', 'SECRET2', 'SECRET3']) {
        expect(printed).not.toContain(secret);
      }
      expect(consoleSpy.mock.calls[0][1]).toMatchObject({
        url: `${BASE}/files?access_token=[REDACTED]&X-Amz-Signature=[REDACTED]&code=[REDACTED]&page=2`,
      });
      // The live request keeps its real query.
      expect(new URL(sentRequest().url).searchParams.get('code')).toBe(
        'SECRET3'
      );
    });

    it('matches percent-encoded parameter names', async () => {
      const consoleSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);

      await valifetch.get(`${BASE}/files?api%5Fkey=SECRET&q=a%20b`, {
        debug: true,
      });

      const { url } = consoleSpy.mock.calls[0][1] as { url: string };
      expect(url).not.toContain('SECRET');
      expect(url).toBe(`${BASE}/files?api_key=[REDACTED]&q=a%20b`);
    });

    it('leaves a URL with no sensitive parameters byte-for-byte unchanged', async () => {
      const consoleSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);

      await valifetch.get(`${BASE}/files?q=a+b&page=2`, { debug: true });

      expect(consoleSpy.mock.calls[0][1]).toMatchObject({
        url: `${BASE}/files?q=a+b&page=2`,
      });
    });

    it.each([
      'x-csrf-token',
      'x-xsrf',
      'dpop',
      'x-otp',
      'x-jwt',
      'x-passphrase',
      'x-sig',
      'x-bearer',
    ])('redacts the %s header', async (name) => {
      const consoleSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation(() => undefined);

      await valifetch.get(`${BASE}/users`, {
        debug: true,
        headers: { [name]: 'HEADER-SECRET' },
      });

      expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain(
        'HEADER-SECRET'
      );
    });
  });

  describe('prefixUrl with a query or fragment', () => {
    it.each([
      'https://api.example.com/v1?k=1',
      'https://api.example.com/v1?',
      'https://api.example.com/v1#frag',
    ])('rejects %s', (prefixUrl) => {
      expect(() => buildUrl({ prefixUrl, path: '/users' })).toThrow(
        new TypeError(
          'prefixUrl must not contain a query string or fragment; use searchParams instead'
        )
      );
    });

    it('the error message never echoes the prefix query', async () => {
      const error = (await valifetch
        .get('/users', { prefixUrl: `${BASE}/v1?api_key=SECRET` })
        .catch((e: unknown) => e)) as Error;

      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).not.toContain('SECRET');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('valifetch/mock hardening', () => {
    it('records a __proto__ header as a plain own key', async () => {
      const mock = createMock();
      mock.get('/users').reply(200, []);
      const api = valifetch.extend({ hooks: mock.hooks });

      await api.get(`${BASE}/users`, { headers: [['__proto__', 'value']] });

      const call = mock.lastCall();
      expect(Object.getPrototypeOf(call?.headers)).toBe(Object.prototype);
      expect(Object.hasOwn(call?.headers ?? {}, '__proto__')).toBe(true);
      expect(call?.headers.__proto__).toBe('value');
    });

    it('a pattern with a run of * does not backtrack on a non-matching path', async () => {
      const mock = createMock();
      mock.get('/a***b').reply(200, { matched: true });
      const api = valifetch.extend({ hooks: mock.hooks });

      // `.*.*.*` would backtrack cubically on this path (seconds); a collapsed
      // single `.*` rejects it in linear time.
      const start = performance.now();
      await api.get(`${BASE}/a${'x'.repeat(1500)}`);
      expect(performance.now() - start).toBeLessThan(250);
      // Unmatched, so it fell through to (spied) fetch.
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      await expect(api.get(`${BASE}/aXYb`)).resolves.toEqual({
        matched: true,
      });
    });
  });
});
