import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { valifetch } from '../../src/core/valifetch';
import { ValifetchError } from '../../src/errors/ValifetchError';
import type { DownloadProgressEvent } from '../../src/types';

describe('instance/request option parity', () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  const jsonResponse = (body: unknown = { ok: true }) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const requestedUrl = (index = 0): URL =>
    new URL((fetchSpy.mock.calls[index][0] as Request).url);

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockImplementation(() => Promise.resolve(jsonResponse()));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  describe('extend() merge parity', () => {
    it('carries dedupe from the child options', async () => {
      const api = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .extend({ dedupe: true });

      await Promise.all([api.get('/users'), api.get('/users')]);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('carries onDownloadProgress from the child options', async () => {
      const events: DownloadProgressEvent[] = [];
      const api = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .extend({ onDownloadProgress: (event) => events.push(event) });

      await api.get('/users');

      expect(events.length).toBeGreaterThan(0);
    });

    it('carries priority through to the fetch init', async () => {
      const RealRequest = globalThis.Request;
      const requestSpy = vi.fn(function (
        input: RequestInfo | URL,
        init?: RequestInit
      ) {
        return new RealRequest(input, init);
      });
      vi.stubGlobal('Request', requestSpy);

      const api = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .extend({ priority: 'high' });

      await api.get('/users');

      expect(requestSpy.mock.calls[0][1]?.priority).toBe('high');
    });

    it('ignores child keys explicitly set to undefined', async () => {
      const api = valifetch
        .create({ prefixUrl: 'https://api.example.com', timeout: 5000 })
        .extend({ timeout: undefined });

      await api.get('/users');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('collapses header names that differ only in case, child winning', async () => {
      const api = valifetch
        .create({
          prefixUrl: 'https://api.example.com',
          headers: { 'Content-Type': 'application/json' },
        })
        .extend({ headers: { 'content-type': 'application/xml' } });

      await api.get('/users');

      const sent = fetchSpy.mock.calls[0][0] as Request;
      expect(sent.headers.get('content-type')).toBe('application/xml');
    });
  });

  describe('instance-level searchParams', () => {
    it('applies instance defaults alongside request params', async () => {
      const api = valifetch.create({
        prefixUrl: 'https://api.example.com',
        searchParams: { api_key: 'k' },
      });

      await api.get('/users', { searchParams: { page: 2 } });

      const url = requestedUrl();
      expect(url.searchParams.get('api_key')).toBe('k');
      expect(url.searchParams.get('page')).toBe('2');
    });

    it('lets a request param replace the instance value for the same key', async () => {
      const api = valifetch.create({
        prefixUrl: 'https://api.example.com',
        searchParams: { version: '1' },
      });

      await api.get('/users', { searchParams: { version: '2' } });

      const url = requestedUrl();
      expect(url.searchParams.getAll('version')).toEqual(['2']);
    });

    it('merges parent and child searchParams across extend()', async () => {
      const api = valifetch
        .create({
          prefixUrl: 'https://api.example.com',
          searchParams: { api_key: 'k', version: '1' },
        })
        .extend({ searchParams: { version: '2' } });

      await api.get('/users');

      const url = requestedUrl();
      expect(url.searchParams.get('api_key')).toBe('k');
      expect(url.searchParams.getAll('version')).toEqual(['2']);
    });
  });

  describe('instance-level onDownloadProgress', () => {
    it('fires for a request that sets no callback of its own', async () => {
      const events: DownloadProgressEvent[] = [];
      const api = valifetch.create({
        prefixUrl: 'https://api.example.com',
        onDownloadProgress: (event) => events.push(event),
      });

      await api.get('/users');

      expect(events.length).toBeGreaterThan(0);
      expect(events.at(-1)?.loaded).toBeGreaterThan(0);
    });
  });

  describe('non-JSON body reads', () => {
    it('wraps a failing body read in a PARSE_ERROR', async () => {
      const response = jsonResponse();
      const cause = new TypeError('could not parse content as FormData');
      response.formData = () => Promise.reject(cause);
      fetchSpy.mockImplementation(() => Promise.resolve(response));

      const error = await valifetch
        .get('https://api.example.com/users', { responseType: 'formData' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('PARSE_ERROR');
      expect((error as ValifetchError).message).toBe(
        'Failed to parse response as formData'
      );
      expect((error as ValifetchError).cause).toBe(cause);
      expect((error as ValifetchError).response).toBe(response);
      expect((error as ValifetchError).request).toBeInstanceOf(Request);
    });
  });

  describe('afterResponse on a hook-provided response', () => {
    it('runs afterResponse hooks for a response returned by beforeRequest', async () => {
      const seen: number[] = [];
      const api = valifetch.create({
        prefixUrl: 'https://api.example.com',
        hooks: {
          beforeRequest: [() => new Response('{}', { status: 401 })],
          afterResponse: [
            (_request, _options, response) => {
              seen.push(response.status);
              return jsonResponse({ refreshed: true });
            },
          ],
        },
      });

      const data = await api.get<{ refreshed: boolean }>('/users');

      expect(seen).toEqual([401]);
      expect(data).toEqual({ refreshed: true });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('timeout detection', () => {
    it('reports ABORT_ERROR when the caller aborts with a look-alike message', async () => {
      fetchSpy.mockImplementation(
        (_input, init) =>
          new Promise<Response>((_, reject) => {
            const signal = init?.signal;
            if (!signal) return;
            if (signal.aborted) {
              reject(signal.reason);
              return;
            }
            signal.addEventListener('abort', () => reject(signal.reason));
          })
      );

      const controller = new AbortController();
      const promise = valifetch.get('https://api.example.com/users', {
        timeout: 5000,
        retry: false,
        signal: controller.signal,
      });
      controller.abort(new Error('Request timed out'));

      const error = await promise.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('ABORT_ERROR');
    });
  });

  describe('callable typing', () => {
    it('accepts method and responseType on the call signature', async () => {
      const api = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .callable();

      await api('/users', { method: 'POST', json: { name: 'a' } });
      const text = await api<string>('/users', { responseType: 'text' });

      expect((fetchSpy.mock.calls[0][0] as Request).method).toBe('POST');
      expect(typeof text).toBe('string');
      // @ts-expect-error - head never reads a body, so responseType is rejected
      await api.head('/users', { responseType: 'text' });
    });
  });
});
