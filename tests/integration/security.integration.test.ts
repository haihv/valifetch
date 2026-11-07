import { describe, expect, it } from 'vitest';
import { bearerAuth } from '../../src/auth';
import { valifetch } from '../../src/core/valifetch';
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
});
