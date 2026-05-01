import * as v from 'valibot';
import { bench, describe } from 'vitest';
import { valifetch } from '../src/core/valifetch';
import { mockFetch } from './_mock-fetch';

// Must be at module scope — beforeAll/afterAll run in a different context than bench iterations
mockFetch({ id: 1, name: 'Alice' });

const TEST_URL = 'https://api.example.com/users/1';

const flatSchema = v.object({ id: v.number(), name: v.string() });
const complexSchema = v.array(
  v.object({
    id: v.number(),
    name: v.string(),
    email: v.string(),
    role: v.union([v.literal('admin'), v.literal('user'), v.literal('guest')]),
  })
);

const noopHook = async (req: Request) => req;
const prefixApi = valifetch.create({ prefixUrl: 'https://api.example.com' });

describe('valifetch (full pipeline, fetch mocked)', () => {
  bench('GET — no options, no schema (baseline)', async () => {
    await valifetch.get(TEST_URL);
  });

  bench('GET — flat responseSchema', async () => {
    await valifetch.get(TEST_URL, { responseSchema: flatSchema });
  });

  bench('GET — retry: false (skips normalizeRetryOptions)', async () => {
    await valifetch.get(TEST_URL, { retry: false });
  });

  bench('GET — beforeRequest hook (noop)', async () => {
    await valifetch.get(TEST_URL, {
      hooks: { beforeRequest: [noopHook] },
    });
  });

  bench('GET — instance with prefixUrl, path only', async () => {
    await prefixApi.get('/users/1');
  });

  bench('POST — json body', async () => {
    await valifetch.post(TEST_URL, { json: { name: 'Alice' } });
  });
});
