import { describe, expect, it } from 'vitest';
import { bearerAuth } from '../../src/auth';
import { valifetch } from '../../src/core/valifetch';
import { ValifetchError } from '../../src/errors/ValifetchError';
import { createTestServer } from './helpers';

describe('integration — security', () => {
  it('drops Authorization and Cookie when a redirect crosses origins', async () => {
    let seen: Record<string, string | undefined> = {};
    const target = createTestServer((req, res) => {
      seen = {
        authorization: req.headers.authorization,
        cookie: req.headers.cookie,
        trace: req.headers['x-trace'] as string | undefined,
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    const targetUrl = await target.start();

    // A different port is a different origin.
    const origin = createTestServer((_req, res) => {
      res.writeHead(302, { Location: `${targetUrl}/landing` });
      res.end();
    });
    const originUrl = await origin.start();

    try {
      const api = valifetch.create({
        prefixUrl: originUrl,
        headers: { cookie: 'sid=secret', 'x-trace': 'kept' },
        hooks: { beforeRequest: [bearerAuth(() => 'secret-token')] },
      });
      await api.get('/start');
    } finally {
      await origin.stop();
      await target.stop();
    }

    expect(seen.trace).toBe('kept');
    expect(seen.authorization).toBeUndefined();
    expect(seen.cookie).toBeUndefined();
  });
  it('does not retry when Retry-After exceeds maxRetryAfter', async () => {
    let hits = 0;
    const server = createTestServer((_req, res) => {
      hits++;
      res.writeHead(429, { 'retry-after': '120' });
      res.end();
    });
    const url = await server.start();

    try {
      const started = Date.now();
      const error = await valifetch
        .get(`${url}/limited`, { retry: { limit: 2, maxRetryAfter: 50 } })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).status).toBe(429);
      expect(hits).toBe(1);
      expect(Date.now() - started).toBeLessThan(1_000);
    } finally {
      await server.stop();
    }
  });

  it('yields a CR-terminated SSE event without waiting for the next chunk', async () => {
    const server = createTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      // Sends one CR-terminated event, then pauses indefinitely.
      res.write('data: a\r\r');
    });
    const url = await server.start();

    try {
      const events = await valifetch.get<AsyncIterable<MessageEvent>>(
        `${url}/events`,
        { responseType: 'sse' }
      );
      const iterator = events[Symbol.asyncIterator]();
      const first = await Promise.race([
        iterator.next(),
        new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), 1_000)
        ),
      ]);

      expect(first).not.toBe('timeout');
      expect((first as IteratorResult<MessageEvent>).value.data).toBe('a');
      await iterator.return?.();
    } finally {
      await server.stop();
    }
  });

  it('breaking out of an SSE loop closes the connection', async () => {
    let closed: Promise<void> = Promise.resolve();
    const server = createTestServer((req, res) => {
      closed = new Promise((resolve) => req.socket.on('close', resolve));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: first\n\n');
      // Never ends on its own.
    });
    const url = await server.start();

    try {
      const events = await valifetch.get<AsyncIterable<MessageEvent>>(
        `${url}/events`,
        { responseType: 'sse' }
      );
      for await (const _event of events) {
        break;
      }

      const outcome = await Promise.race([
        closed.then(() => 'closed'),
        new Promise((resolve) => setTimeout(() => resolve('open'), 2_000)),
      ]);
      expect(outcome).toBe('closed');
    } finally {
      await server.stop();
    }
  });
});
