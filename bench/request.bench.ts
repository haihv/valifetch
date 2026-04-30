import * as v from 'valibot';
import { bench, describe } from 'vitest';
import { buildRequest } from '../src/core/request';

// buildRequest builds a Request object but does NOT call fetch — no mock needed.

const INSTANCE_OPTS = {};
const URL = 'https://api.example.com/users';
const flatBodySchema = v.object({ name: v.string(), age: v.number() });
const paramsSchema = v.object({ id: v.string() });

describe('buildRequest', () => {
  bench('no body, no schema, no params — baseline', async () => {
    await buildRequest(URL, 'GET', {}, INSTANCE_OPTS);
  });

  bench('json body + Content-Type header merge', async () => {
    await buildRequest(URL, 'POST', { json: { name: 'Alice', age: 30 } }, INSTANCE_OPTS);
  });

  bench('json body + bodySchema validation', async () => {
    await buildRequest(
      URL,
      'POST',
      { json: { name: 'Alice', age: 30 }, bodySchema: flatBodySchema },
      INSTANCE_OPTS
    );
  });

  bench('path param replacement (:id)', async () => {
    await buildRequest(
      'https://api.example.com/users/:id',
      'GET',
      { params: { id: '42' } },
      INSTANCE_OPTS
    );
  });

  bench('path param + paramsSchema validation', async () => {
    await buildRequest(
      'https://api.example.com/users/:id',
      'GET',
      { params: { id: '42' }, paramsSchema },
      INSTANCE_OPTS
    );
  });

  bench('searchParams (record, 3 keys)', async () => {
    await buildRequest(URL, 'GET', { searchParams: { q: 'foo', page: '1', limit: '20' } }, INSTANCE_OPTS);
  });

  bench('instance headers + request headers merge', async () => {
    await buildRequest(
      URL,
      'GET',
      { headers: { 'X-Request-ID': 'abc123' } },
      { headers: { Authorization: 'Bearer token' } }
    );
  });
});
