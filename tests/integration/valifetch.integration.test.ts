import { describe, expect, it } from 'vitest';
import { valifetch } from '../../src/core/valifetch';
import { createTestServer, readBody } from './helpers';

describe('integration — real HTTP server', () => {
  it('fires onDownloadProgress with correct loaded/total/percent on chunked response', async () => {
    const data = JSON.stringify({
      message: 'chunked response test payload for progress tracking',
    });
    const totalBytes = Buffer.byteLength(data);
    const half = Math.floor(totalBytes / 2);
    const chunk1 = data.slice(0, half);
    const chunk2 = data.slice(half);

    const { start, stop } = createTestServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': String(totalBytes),
      });
      res.write(chunk1);
      // Small delay ensures chunks reach the client separately
      setTimeout(() => {
        res.write(chunk2);
        res.end();
      }, 20);
    });

    const url = await start();
    const events: Array<{
      loaded: number;
      total: number | undefined;
      percent: number | undefined;
    }> = [];

    try {
      await valifetch.get(url, {
        onDownloadProgress: (e) => events.push(e),
      });
    } finally {
      await stop();
    }

    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.loaded).toBe(totalBytes);
    expect(last.total).toBe(totalBytes);
    expect(last.percent).toBe(100);
  });

  it('sends multipart/form-data and server receives fields correctly', async () => {
    let receivedContentType = '';
    let receivedBody = '';

    const { start, stop } = createTestServer(async (req, res) => {
      receivedContentType = req.headers['content-type'] ?? '';
      const buf = await readBody(req);
      receivedBody = buf.toString();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    });

    const url = await start();
    const formData = new FormData();
    formData.append('username', 'valifetch');
    formData.append('version', '42');

    try {
      await valifetch.post(url, { form: formData });
    } finally {
      await stop();
    }

    expect(receivedContentType).toContain('multipart/form-data');
    expect(receivedContentType).toContain('boundary=');
    expect(receivedBody).toContain('name="username"');
    expect(receivedBody).toContain('valifetch');
    expect(receivedBody).toContain('name="version"');
    expect(receivedBody).toContain('42');
  });

  it('retries after 503 and resolves on the subsequent 200', async () => {
    let requestCount = 0;

    const { start, stop } = createTestServer((req, res) => {
      requestCount++;
      if (requestCount === 1) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Service Unavailable' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      }
    });

    const url = await start();

    try {
      const result = await valifetch.get(url, {
        retry: { limit: 1, delay: () => 0 },
      });
      expect(result).toEqual({ ok: true });
      expect(requestCount).toBe(2);
    } finally {
      await stop();
    }
  });

  it('throws TIMEOUT_ERROR when server does not respond within the timeout', async () => {
    const { start, stop } = createTestServer((_req, _res) => {
      // Intentionally never responds to simulate a hanging server
    });

    const url = await start();

    try {
      await expect(valifetch.get(url, { timeout: 50 })).rejects.toMatchObject({
        code: 'TIMEOUT_ERROR',
      });
    } finally {
      await stop();
    }
  });

  describe('prefixUrl + path edge cases', () => {
    it('joins prefixUrl with trailing slash and path without leading slash', async () => {
      let receivedPath = '';

      const { start, stop } = createTestServer((req, res) => {
        receivedPath = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });

      const url = await start();
      const client = valifetch.create({ prefixUrl: `${url}/` });

      try {
        await client.get('users/profile');
        expect(receivedPath).toBe('/users/profile');
      } finally {
        await stop();
      }
    });

    it('joins prefixUrl without trailing slash and path with leading slash', async () => {
      let receivedPath = '';

      const { start, stop } = createTestServer((req, res) => {
        receivedPath = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });

      const url = await start();
      const client = valifetch.create({ prefixUrl: url });

      try {
        await client.get('/api/v1/items');
        expect(receivedPath).toBe('/api/v1/items');
      } finally {
        await stop();
      }
    });

    it('correctly encodes search param values containing special characters', async () => {
      let receivedUrl = '';

      const { start, stop } = createTestServer((req, res) => {
        receivedUrl = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });

      const url = await start();
      const client = valifetch.create({ prefixUrl: url });

      try {
        await client.get('/search', {
          searchParams: { q: 'hello world', filter: 'a&b' },
        });
        // Parse what the server received to check decoded values
        const parsed = new URL(`http://127.0.0.1${receivedUrl}`);
        expect(parsed.pathname).toBe('/search');
        expect(parsed.searchParams.get('q')).toBe('hello world');
        expect(parsed.searchParams.get('filter')).toBe('a&b');
      } finally {
        await stop();
      }
    });
  });

  it('Retry-After header — client waits the prescribed delay before retrying 429', async () => {
    let requestCount = 0;
    const startTime = Date.now();
    let retryTime = 0;

    const { start, stop } = createTestServer((_req, res) => {
      requestCount++;
      if (requestCount === 1) {
        res.writeHead(429, { 'retry-after': '1' });
        res.end();
      } else {
        retryTime = Date.now();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      }
    });

    const url = await start();

    try {
      const result = await valifetch.get(url, {
        retry: { limit: 1, methods: ['GET'], statusCodes: [429] },
      });

      expect(result).toEqual({ ok: true });
      expect(requestCount).toBe(2);
      // Retry-After: 1 → at least ~1 000 ms elapsed between first request and retry
      expect(retryTime - startTime).toBeGreaterThanOrEqual(900);
    } finally {
      await stop();
    }
  });

  it('afterResponse hook can replace a 401 response with a refreshed one', async () => {
    // Server: returns 401 without the magic header, 200 with it
    const { start, stop } = createTestServer((req, res) => {
      if (req.headers['x-token'] === 'valid') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ user: 'alice' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
    });

    const url = await start();

    try {
      const result = await valifetch.get(url, {
        retry: false,
        hooks: {
          afterResponse: [
            async (_req, _opts, response) => {
              if (response.status === 401) {
                // Simulate a token refresh by re-fetching with the correct header
                return fetch(url, { headers: { 'x-token': 'valid' } });
              }
            },
          ],
        },
      });

      expect(result).toEqual({ user: 'alice' });
    } finally {
      await stop();
    }
  });
});
