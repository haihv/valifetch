/**
 * Apples-to-apples comparison across fetch-based HTTP clients.
 * All libs share the same module-scope fetch mock (no real network I/O).
 *
 * Axios is configured with adapter:'fetch' so it goes through the same mock
 * path as the other libs instead of Node's http module.
 *
 * Schema validation scenario uses valibot for valifetch and up-fetch (both
 * support it natively). ky and ofetch have no built-in schema support so they
 * are excluded from that group to keep comparisons honest.
 *
 * Error path scenario measures the cost of 4xx error construction per lib.
 * Each bench iteration sets globalThis.fetch to the appropriate mock inline;
 * the assignment (~1ns) is negligible relative to error construction (~5–10µs).
 */
import axios from 'axios';
import ky from 'ky';
import { ofetch } from 'ofetch';
import { up } from 'up-fetch';
import * as v from 'valibot';
import { bench, describe } from 'vitest';
import { valifetch } from '../src/core/valifetch';

const TEST_URL = 'https://api.example.com/users/1';
const PAYLOAD = { id: 1, name: 'Alice' };
const POST_BODY = { name: 'Alice', age: 30 };

const okFetch = (): Promise<Response> =>
  Promise.resolve(
    new Response(JSON.stringify(PAYLOAD), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    })
  );

const errorFetch = (): Promise<Response> =>
  Promise.resolve(
    new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'application/json' },
    })
  );

// Default mock for GET/POST groups
globalThis.fetch = okFetch;

// Instances created once, outside bench loops
const axiosClient = axios.create({ adapter: 'fetch' });
const upfetchClient = up(fetch);

const flatSchema = v.object({ id: v.number(), name: v.string() });

describe('GET + JSON parse — no schema', () => {
  bench('valifetch', async () => {
    globalThis.fetch = okFetch;
    await valifetch.get(TEST_URL);
  });

  bench('ky', async () => {
    globalThis.fetch = okFetch;
    await ky.get(TEST_URL).json();
  });

  bench('ofetch', async () => {
    globalThis.fetch = okFetch;
    await ofetch(TEST_URL);
  });

  bench('up-fetch', async () => {
    globalThis.fetch = okFetch;
    await upfetchClient(TEST_URL);
  });

  bench('axios (fetch adapter)', async () => {
    globalThis.fetch = okFetch;
    await axiosClient.get(TEST_URL);
  });
});

describe('GET + JSON parse + schema validation', () => {
  bench('valifetch + valibot', async () => {
    globalThis.fetch = okFetch;
    await valifetch.get(TEST_URL, { responseSchema: flatSchema });
  });

  bench('up-fetch + valibot', async () => {
    globalThis.fetch = okFetch;
    await upfetchClient(TEST_URL, { schema: flatSchema });
  });
});

describe('POST with JSON body', () => {
  bench('valifetch', async () => {
    globalThis.fetch = okFetch;
    await valifetch.post(TEST_URL, { json: POST_BODY });
  });

  bench('ky', async () => {
    globalThis.fetch = okFetch;
    await ky.post(TEST_URL, { json: POST_BODY }).json();
  });

  bench('ofetch', async () => {
    globalThis.fetch = okFetch;
    // ofetch auto-serializes plain objects as JSON
    await ofetch(TEST_URL, { method: 'POST', body: POST_BODY });
  });

  bench('up-fetch', async () => {
    globalThis.fetch = okFetch;
    await upfetchClient(TEST_URL, { method: 'POST', body: POST_BODY });
  });

  bench('axios (fetch adapter)', async () => {
    globalThis.fetch = okFetch;
    await axiosClient.post(TEST_URL, POST_BODY);
  });
});

describe('4xx error path', () => {
  bench('valifetch', async () => {
    globalThis.fetch = errorFetch;
    try { await valifetch.get(TEST_URL); } catch {}
  });

  bench('ky', async () => {
    globalThis.fetch = errorFetch;
    try { await ky.get(TEST_URL).json(); } catch {}
  });

  bench('ofetch', async () => {
    globalThis.fetch = errorFetch;
    try { await ofetch(TEST_URL); } catch {}
  });

  bench('up-fetch', async () => {
    globalThis.fetch = errorFetch;
    try { await upfetchClient(TEST_URL); } catch {}
  });

  bench('axios (fetch adapter)', async () => {
    globalThis.fetch = errorFetch;
    try { await axiosClient.get(TEST_URL); } catch {}
  });
});
