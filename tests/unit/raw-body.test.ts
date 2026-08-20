import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { valifetch } from '../../src/core/valifetch';
import type { RawBody } from '../../src/types';

const streamOf = (text: string): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

describe('raw request bodies', () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  const jsonResponse = () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const sentRequest = (index = 0): Request =>
    fetchSpy.mock.calls[index][0] as Request;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockImplementation(() => Promise.resolve(jsonResponse()));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  describe('body kinds', () => {
    it('sends a string body verbatim and leaves Content-Type untouched', async () => {
      await valifetch.post('https://api.example.com/raw', {
        body: 'plain payload',
        headers: { 'content-type': 'text/plain' },
      });

      const request = sentRequest();
      expect(await request.text()).toBe('plain payload');
      expect(request.headers.get('content-type')).toBe('text/plain');
      expect(request.headers.get('accept')).toBeNull();
    });

    it('does not add a Content-Type or Accept header for raw bodies', async () => {
      // A byte body has no platform-level `Content-Type` default, so anything
      // present here would have to come from valifetch itself.
      await valifetch.post('https://api.example.com/raw', {
        body: new Uint8Array([1]),
      });

      const request = sentRequest();
      expect(request.headers.get('content-type')).toBeNull();
      expect(request.headers.get('accept')).toBeNull();
    });

    it('keeps the platform Content-Type default for string bodies', async () => {
      await valifetch.post('https://api.example.com/raw', { body: 'payload' });

      // Set by the `Request` constructor per the Fetch spec, not by valifetch.
      expect(sentRequest().headers.get('content-type')).toBe(
        'text/plain;charset=UTF-8'
      );
    });

    it('sends a Blob body', async () => {
      await valifetch.post('https://api.example.com/raw', {
        body: new Blob([new Uint8Array([1, 2, 3])]),
      });

      const bytes = new Uint8Array(await sentRequest().arrayBuffer());
      expect([...bytes]).toEqual([1, 2, 3]);
    });

    it('sends an ArrayBuffer body', async () => {
      await valifetch.post('https://api.example.com/raw', {
        body: new Uint8Array([4, 5, 6]).buffer,
      });

      const bytes = new Uint8Array(await sentRequest().arrayBuffer());
      expect([...bytes]).toEqual([4, 5, 6]);
    });

    it('sends a typed-array body', async () => {
      await valifetch.post('https://api.example.com/raw', {
        body: new Uint8Array([7, 8, 9]),
      });

      const bytes = new Uint8Array(await sentRequest().arrayBuffer());
      expect([...bytes]).toEqual([7, 8, 9]);
    });

    it('sends a ReadableStream body with duplex: half', async () => {
      const RealRequest = globalThis.Request;
      const requestSpy = vi.fn(function (
        input: RequestInfo | URL,
        init?: RequestInit
      ) {
        return new RealRequest(input, init);
      });
      vi.stubGlobal('Request', requestSpy);

      await valifetch.post('https://api.example.com/raw', {
        body: streamOf('streamed'),
      });

      const init = requestSpy.mock.calls[0][1] as
        | (RequestInit & { duplex?: 'half' })
        | undefined;
      expect(init?.duplex).toBe('half');
      expect(await sentRequest().text()).toBe('streamed');
    });

    it('merges instance headers with request headers for raw bodies', async () => {
      const api = valifetch.create({
        prefixUrl: 'https://api.example.com',
        headers: { 'x-instance': 'yes' },
      });

      await api.post('/raw', {
        body: 'payload',
        headers: { 'content-type': 'application/octet-stream' },
      });

      const request = sentRequest();
      expect(request.headers.get('x-instance')).toBe('yes');
      expect(request.headers.get('content-type')).toBe(
        'application/octet-stream'
      );
    });
  });

  describe('mutual exclusion', () => {
    const message =
      'Only one of `json`, `form`, or `body` may be set on a request';

    it('rejects when json and form are both set', async () => {
      await expect(
        valifetch.post('https://api.example.com/raw', {
          json: { a: 1 },
          form: { b: '2' },
        })
      ).rejects.toThrow(new TypeError(message));
    });

    it('rejects when json and body are both set', async () => {
      await expect(
        valifetch.post('https://api.example.com/raw', {
          json: { a: 1 },
          body: 'payload',
        })
      ).rejects.toThrow(new TypeError(message));
    });

    it('rejects when form and body are both set', async () => {
      await expect(
        valifetch.post('https://api.example.com/raw', {
          form: { b: '2' },
          body: 'payload',
        })
      ).rejects.toThrow(new TypeError(message));
    });

    it('rejects when all three are set', async () => {
      await expect(
        valifetch.post('https://api.example.com/raw', {
          json: { a: 1 },
          form: { b: '2' },
          body: 'payload',
        })
      ).rejects.toThrow(new TypeError(message));
    });

    it('accepts each body kind on its own', async () => {
      await valifetch.post('https://api.example.com/a', { json: { a: 1 } });
      await valifetch.post('https://api.example.com/b', { form: { b: '2' } });
      await valifetch.post('https://api.example.com/c', { body: 'payload' });

      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('retry', () => {
    const retryOnce = {
      limit: 1,
      methods: ['PUT' as const],
      statusCodes: [503],
      delay: () => 0,
    };

    it('re-sends a Blob body on retry', async () => {
      const bodies: string[] = [];
      fetchSpy.mockImplementation(async (input) => {
        bodies.push(await (input as Request).text());
        return bodies.length === 1
          ? new Response('{}', { status: 503 })
          : jsonResponse();
      });

      await valifetch.put('https://api.example.com/raw', {
        body: new Blob(['blob payload']),
        retry: retryOnce,
      });

      expect(bodies).toEqual(['blob payload', 'blob payload']);
    });

    it('re-sends a ReadableStream body on retry', async () => {
      const bodies: string[] = [];
      fetchSpy.mockImplementation(async (input) => {
        bodies.push(await (input as Request).text());
        return bodies.length === 1
          ? new Response('{}', { status: 503 })
          : jsonResponse();
      });

      await valifetch.put('https://api.example.com/raw', {
        body: streamOf('stream payload'),
        retry: retryOnce,
      });

      expect(bodies).toEqual(['stream payload', 'stream payload']);
    });
  });

  describe('types', () => {
    it('accepts raw bodies on body-bearing methods only', () => {
      const api = valifetch.create({ prefixUrl: 'https://api.example.com' });

      expectTypeOf(api.post).toBeCallableWith('/raw', { body: 'payload' });
      // @ts-expect-error — GET has no body option
      void (() => api.get('/raw', { body: 'payload' }));
    });

    it('accepts raw bodies through the callable form', async () => {
      const api = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .callable();
      const blob: RawBody = new Blob(['payload']);

      await api('/raw', { method: 'PUT', body: blob });

      const request = sentRequest();
      expect(request.method).toBe('PUT');
      expect(await request.text()).toBe('payload');
    });
  });
});
