/**
 * Apples-to-apples comparison: GET + JSON parse across fetch-based HTTP clients.
 * All libs share the same module-scope fetch mock (no real network I/O).
 *
 * Axios is configured with adapter:'fetch' so it goes through the same mock path
 * as the other libs instead of Node's http module.
 *
 * Schema validation scenario uses valibot for valifetch and up-fetch (both
 * support it natively). ky and ofetch have no built-in schema support so they
 * are excluded from that group to keep comparisons honest.
 */
import axios from 'axios';
import ky from 'ky';
import { ofetch } from 'ofetch';
import { up } from 'up-fetch';
import * as v from 'valibot';
import { bench, describe } from 'vitest';
import { valifetch } from '../src/core/valifetch';

const URL = 'https://api.example.com/users/1';
const PAYLOAD = { id: 1, name: 'Alice' };

// Module-scope mock — must be set before any lib initialises its instance
globalThis.fetch = () =>
  Promise.resolve(
    new Response(JSON.stringify(PAYLOAD), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    })
  );

// Instances created once, outside bench loops
const axiosClient = axios.create({ adapter: 'fetch' });
const upfetchClient = up(fetch);
// ky and ofetch are used directly (no instance needed for baseline)

const flatSchema = v.object({ id: v.number(), name: v.string() });

describe('GET + JSON parse — no schema', () => {
  bench('valifetch', async () => {
    await valifetch.get(URL);
  });

  bench('ky', async () => {
    await ky.get(URL).json();
  });

  bench('ofetch', async () => {
    await ofetch(URL);
  });

  bench('up-fetch', async () => {
    await upfetchClient(URL);
  });

  bench('axios (fetch adapter)', async () => {
    await axiosClient.get(URL);
  });
});

describe('GET + JSON parse + schema validation', () => {
  bench('valifetch + valibot', async () => {
    await valifetch.get(URL, { responseSchema: flatSchema });
  });

  bench('up-fetch + valibot', async () => {
    await upfetchClient(URL, { schema: flatSchema });
  });
});
