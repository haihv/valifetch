import * as v from 'valibot';
import { describe, expect, inject, it } from 'vitest';
import { server } from 'vitest/browser';
import { valifetch } from '../../src/core/valifetch';

const origin = inject('serverOrigin');
const engine = server.browser;

type Echo = { method: string; contentType: string; body: string };

let keyCounter = 0;
/** Unique key so stateful server routes never share counters between tests. */
function uniqueKey(): string {
  keyCounter += 1;
  return `${engine}-${keyCounter}-${Math.random().toString(36).slice(2)}`;
}

describe(`browser smoke (${engine}) — native fetch`, () => {
  it('GET validates the response against a schema', async () => {
    const data = await valifetch.get(`${origin}/json`, {
      responseSchema: v.object({ id: v.number(), name: v.string() }),
    });
    expect(data).toEqual({ id: 1, name: 'valifetch' });
  });

  it('GET rejects with VALIDATION_ERROR on a schema mismatch', async () => {
    await expect(
      valifetch.get(`${origin}/json`, {
        responseSchema: v.object({ id: v.string() }),
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('POST json sends a JSON body and Content-Type across origins', async () => {
    const echo = (await valifetch.post(`${origin}/echo`, {
      json: { hello: 'world' },
    })) as Echo;
    expect(echo.method).toBe('POST');
    expect(echo.contentType).toContain('application/json');
    expect(JSON.parse(echo.body)).toEqual({ hello: 'world' });
  });

  it('4xx rejects with HTTP_ERROR carrying the parsed responseBody', async () => {
    await expect(valifetch.get(`${origin}/missing`)).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 404,
      responseBody: { message: 'not found' },
    });
  });

  it('retries after 503 and resolves on the following 200', async () => {
    const result = await valifetch.get(`${origin}/flaky?k=${uniqueKey()}`, {
      retry: { limit: 2, delay: () => 10 },
    });
    expect(result).toEqual({ ok: true });
  });

  it('honours a cross-origin Retry-After header on 429', async () => {
    const start = performance.now();
    const result = await valifetch.get(
      `${origin}/rate-limited?k=${uniqueKey()}`,
      { retry: { limit: 1 } }
    );
    expect(result).toEqual({ ok: true });
    expect(performance.now() - start).toBeGreaterThanOrEqual(900);
  });

  it('rejects with TIMEOUT_ERROR when the server does not respond', async () => {
    await expect(
      valifetch.get(`${origin}/hang`, { timeout: 100, retry: 0 })
    ).rejects.toMatchObject({ code: 'TIMEOUT_ERROR' });
  });

  it('.cancel() rejects with ABORT_ERROR', async () => {
    const promise = valifetch.get(`${origin}/hang`, { retry: 0 });
    setTimeout(() => promise.cancel(), 50);
    await expect(promise).rejects.toMatchObject({ code: 'ABORT_ERROR' });
  });

  it('a caller-supplied AbortSignal rejects with ABORT_ERROR', async () => {
    const controller = new AbortController();
    const promise = valifetch.get(`${origin}/hang`, {
      signal: controller.signal,
      retry: 0,
    });
    setTimeout(() => controller.abort(), 50);
    await expect(promise).rejects.toMatchObject({ code: 'ABORT_ERROR' });
  });

  it('combines prefixUrl, path params and searchParams', async () => {
    const result = (await valifetch.get('users/:id', {
      prefixUrl: `${origin}/api`,
      params: { id: 42 },
      searchParams: { q: 'a b&c', page: 2 },
    })) as { path: string; search: string };
    expect(result.path).toBe('/api/users/42');
    const search = new URLSearchParams(result.search);
    expect(search.get('q')).toBe('a b&c');
    expect(search.get('page')).toBe('2');
  });

  it("responseType 'sse' streams events from a chunked response", async () => {
    const stream = (await valifetch.get(`${origin}/sse`, {
      responseType: 'sse',
    })) as AsyncIterable<MessageEvent>;
    const events: MessageEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }
    expect(events.map((e) => [e.type, e.data])).toEqual([
      ['message', 'first'],
      ['update', 'second'],
      ['message', 'third'],
    ]);
    expect(events[2].lastEventId).toBe('3');
  });

  it('onDownloadProgress reports loaded and total from Content-Length', async () => {
    const events: Array<{ loaded: number; total?: number; percent?: number }> =
      [];
    await valifetch.get(`${origin}/progress`, {
      onDownloadProgress: (e) => events.push(e),
    });
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.total).toBeGreaterThan(0);
    expect(last.loaded).toBe(last.total);
    expect(last.percent).toBe(100);
  });

  it('form uploads FormData as multipart/form-data', async () => {
    const form = new FormData();
    form.append('username', 'valifetch');
    form.append(
      'file',
      new Blob(['file-content'], { type: 'text/plain' }),
      'a.txt'
    );
    const echo = (await valifetch.post(`${origin}/echo`, { form })) as Echo;
    expect(echo.contentType).toContain('multipart/form-data');
    expect(echo.contentType).toContain('boundary=');
    expect(echo.body).toContain('name="username"');
    expect(echo.body).toContain('valifetch');
    expect(echo.body).toContain('filename="a.txt"');
    expect(echo.body).toContain('file-content');
  });

  it('raw body sends a string as-is', async () => {
    const echo = (await valifetch.post(`${origin}/echo`, {
      body: 'plain text payload',
    })) as Echo;
    expect(echo.body).toBe('plain text payload');
    expect(echo.contentType).toContain('text/plain');
  });

  it('raw body sends a Blob with its own type', async () => {
    const echo = (await valifetch.post(`${origin}/echo`, {
      body: new Blob(['blob payload'], { type: 'application/x-custom' }),
    })) as Echo;
    expect(echo.body).toBe('blob payload');
    expect(echo.contentType).toBe('application/x-custom');
  });

  // No engine supports a half-duplex streaming upload over the plain HTTP/1.1
  // test server, but they fail differently, so each is asserted explicitly:
  // - Chromium and WebKit reject the request (streaming uploads need HTTP/2+).
  // - Firefox ignores the stream and sends its string form instead, which is
  //   silent data corruption; asserted here so a fix or a change is noticed.
  it("ReadableStream body: documents each engine's actual behaviour", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('streamed'));
        controller.close();
      },
    });
    const request = valifetch.post(`${origin}/echo`, {
      body: stream,
      retry: 0,
    });

    if (engine === 'firefox') {
      const echo = (await request) as Echo;
      expect(echo.body).toBe('[object ReadableStream]');
      expect(echo.contentType).toContain('text/plain');
    } else {
      await expect(request).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    }
  });
});
