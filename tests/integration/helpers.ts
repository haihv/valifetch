import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';

export type Handler = (
  req: IncomingMessage,
  res: ServerResponse
) => void | Promise<void>;

export function createTestServer(handler: Handler): {
  start: () => Promise<string>;
  stop: () => Promise<void>;
} {
  const server: Server = createServer(async (req, res) => {
    try {
      await handler(req, res);
    } catch {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Internal server error');
      }
    }
  });

  let baseUrl = '';

  const start = (): Promise<string> =>
    new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve(baseUrl);
      });
    });

  const stop = (): Promise<void> =>
    new Promise((resolve, reject) => {
      // Force-close all connections so hanging requests (e.g. timeout tests) don't block shutdown
      server.closeAllConnections();
      server.close((err) => (err ? reject(err) : resolve()));
    });

  return { start, stop };
}

export function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
