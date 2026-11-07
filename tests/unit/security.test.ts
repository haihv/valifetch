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
import { parseSSEResponse } from '../../src/core/response';
import {
  DEFAULT_RETRY_OPTIONS,
  getRetryAfterDelay,
  MAX_TIMER_DELAY,
  sleep,
} from '../../src/core/retry';
import { valifetch } from '../../src/core/valifetch';
import { ValifetchError } from '../../src/errors/ValifetchError';
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

    it('the SSE size cap applies through the request pipeline', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(streamOf(['data: ', 'x'.repeat(2 * 1024 * 1024)]), {
          headers: { 'content-type': 'text/event-stream' },
        })
      );

      const events = await valifetch.get<AsyncIterable<MessageEvent>>(
        `${BASE}/events`,
        { responseType: 'sse' }
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

    it('caps a huge Retry-After so a hostile server cannot stall the client', async () => {
      vi.useFakeTimers();
      fetchSpy
        .mockResolvedValueOnce(
          new Response('', {
            status: 429,
            headers: { 'retry-after': '999999999' },
          })
        )
        .mockResolvedValueOnce(jsonResponse());

      const promise = valifetch.get(`${BASE}/users`, { retry: 1 });
      await vi.advanceTimersByTimeAsync(DEFAULT_RETRY_OPTIONS.maxRetryAfter);

      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('maxRetryAfter overrides the Retry-After cap', async () => {
      vi.useFakeTimers();
      fetchSpy
        .mockResolvedValueOnce(
          new Response('', { status: 429, headers: { 'retry-after': '120' } })
        )
        .mockResolvedValueOnce(jsonResponse());

      const promise = valifetch.get(`${BASE}/users`, {
        retry: { limit: 1, maxRetryAfter: 5_000 },
      });
      await vi.advanceTimersByTimeAsync(4_999);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('getRetryAfterDelay clamps a far-future HTTP-date to the cap', () => {
      const response = new Response('', {
        headers: { 'retry-after': 'Fri, 31 Dec 9999 23:59:59 GMT' },
      });
      expect(getRetryAfterDelay(response, 1_000)).toBe(1_000);
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
});
