import * as v from 'valibot';
import { bench, describe } from 'vitest';
import { checkResponseStatus, parseJsonResponse } from '../src/core/response';

const DUMMY_REQUEST = new Request('https://api.example.com/users');

const flatSchema = v.object({ id: v.number(), name: v.string() });
const complexSchema = v.array(
  v.object({
    id: v.number(),
    name: v.string(),
    email: v.string(),
    role: v.union([v.literal('admin'), v.literal('user'), v.literal('guest')]),
    meta: v.object({ createdAt: v.string(), active: v.boolean() }),
  })
);

const flatPayload = { id: 1, name: 'Alice' };
const complexPayload = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: 'user' as const,
  meta: { createdAt: '2024-01-01T00:00:00Z', active: true },
}));

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : String(status),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('response', () => {
  bench('checkResponseStatus — 200 (no-op)', async () => {
    await checkResponseStatus(makeResponse(null, 200), DUMMY_REQUEST, true);
  });

  bench('checkResponseStatus — 404 (throws)', async () => {
    try {
      await checkResponseStatus(makeResponse(null, 404), DUMMY_REQUEST, true);
    } catch {
      // expected
    }
  });

  bench('parseJsonResponse — no schema', async () => {
    await parseJsonResponse({
      response: makeResponse(flatPayload),
      request: DUMMY_REQUEST,
      validateResponse: false,
      throwHttpErrors: true,
    });
  });

  bench('parseJsonResponse — flat schema validation', async () => {
    await parseJsonResponse({
      response: makeResponse(flatPayload),
      request: DUMMY_REQUEST,
      responseSchema: flatSchema,
      validateResponse: true,
      throwHttpErrors: true,
    });
  });

  bench('parseJsonResponse — complex schema (array of 5 objects)', async () => {
    await parseJsonResponse({
      response: makeResponse(complexPayload),
      request: DUMMY_REQUEST,
      responseSchema: complexSchema,
      validateResponse: true,
      throwHttpErrors: true,
    });
  });
});
