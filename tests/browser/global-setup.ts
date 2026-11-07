import type { TestProject } from 'vitest/node';
import { createTestServer, readBody } from '../integration/helpers';

declare module 'vitest' {
  export interface ProvidedContext {
    serverOrigin: string;
  }
}

const SSE_FRAMES = [
  'data: first\n\n',
  'event: update\ndata: second\n\n',
  'id: 3\ndata: third\n\n',
];

const PROGRESS_PAYLOAD = JSON.stringify({ blob: 'x'.repeat(4096) });

/** Per-key request counters so each test gets an isolated stateful route. */
const hits = new Map<string, number>();

function nextHit(key: string): number {
  const n = (hits.get(key) ?? 0) + 1;
  hits.set(key, n);
  return n;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Starts a CORS-enabled HTTP server and hands its origin to the browser tests
 * via `inject('serverOrigin')`. Pages run on a different origin than the
 * server, so every request is a real cross-origin fetch with preflights.
 */
export default async function setup(
  project: TestProject
): Promise<() => Promise<void>> {
  const { start, stop } = createTestServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Retry-After, Content-Length, Content-Type'
    );

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    const key = url.searchParams.get('k') ?? url.pathname;
    const json = { 'Content-Type': 'application/json' };

    switch (url.pathname) {
      case '/json':
        res.writeHead(200, json);
        res.end(JSON.stringify({ id: 1, name: 'valifetch' }));
        return;
      case '/echo': {
        const body = await readBody(req);
        res.writeHead(200, json);
        res.end(
          JSON.stringify({
            method: req.method,
            contentType: req.headers['content-type'] ?? '',
            body: body.toString('latin1'),
          })
        );
        return;
      }
      case '/missing':
        res.writeHead(404, json);
        res.end(JSON.stringify({ message: 'not found' }));
        return;
      case '/flaky':
        if (nextHit(key) === 1) {
          res.writeHead(503, json);
          res.end(JSON.stringify({ message: 'unavailable' }));
          return;
        }
        res.writeHead(200, json);
        res.end(JSON.stringify({ ok: true }));
        return;
      case '/rate-limited':
        if (nextHit(key) === 1) {
          res.writeHead(429, { ...json, 'Retry-After': '1' });
          res.end(JSON.stringify({ message: 'slow down' }));
          return;
        }
        res.writeHead(200, json);
        res.end(JSON.stringify({ ok: true }));
        return;
      case '/hang':
        // Never responds: used for timeout and abort scenarios.
        return;
      case '/sse':
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        });
        for (const frame of SSE_FRAMES) {
          res.write(frame);
          await sleep(20);
        }
        res.end();
        return;
      case '/progress': {
        const half = Math.floor(PROGRESS_PAYLOAD.length / 2);
        res.writeHead(200, {
          ...json,
          'Content-Length': String(Buffer.byteLength(PROGRESS_PAYLOAD)),
        });
        res.write(PROGRESS_PAYLOAD.slice(0, half));
        await sleep(30);
        res.end(PROGRESS_PAYLOAD.slice(half));
        return;
      }
      default:
        if (url.pathname.startsWith('/api/')) {
          res.writeHead(200, json);
          res.end(JSON.stringify({ path: url.pathname, search: url.search }));
          return;
        }
        res.writeHead(404, json);
        res.end(JSON.stringify({ message: 'unknown route' }));
    }
  });

  const origin = await start();
  project.provide('serverOrigin', origin);
  return stop;
}
