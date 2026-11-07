/**
 * Deno runtime smoke test: run with `deno run --allow-net tests/deno/smoke.ts`.
 * Excluded from tsc and vitest because it relies on Deno globals.
 */
import * as v from 'valibot';
import { valifetch } from '../../src/index.ts';

const server = Deno.serve(
  { hostname: '127.0.0.1', port: 0, onListen: () => undefined },
  async (request) => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/users/1') {
      return Response.json({ id: 1, name: 'Ada' });
    }
    if (request.method === 'POST' && url.pathname === '/echo') {
      return Response.json({
        body: await request.text(),
        contentType: request.headers.get('content-type'),
      });
    }
    return new Response('not found', { status: 404 });
  }
);

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label}: expected ${e}, got ${a}`);
  }
  console.log(`ok - ${label}`);
}

try {
  const api = valifetch.create({
    prefixUrl: `http://127.0.0.1:${server.addr.port}`,
    retry: 0,
  });

  const user = await api.get('users/1', {
    responseSchema: v.object({ id: v.number(), name: v.string() }),
  });
  assertEqual(user, { id: 1, name: 'Ada' }, 'JSON GET with responseSchema');

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('streamed '));
      controller.enqueue(encoder.encode('body'));
      controller.close();
    },
  });
  const echoed = await api.post('echo', { body: stream });
  assertEqual(
    echoed,
    { body: 'streamed body', contentType: null },
    'ReadableStream POST body is streamed'
  );
} finally {
  await server.shutdown();
}
