# Mocking in tests

The `valifetch/mock` subpath provides `createMock()`, a lightweight mock that intercepts requests through the `beforeRequest` hook. It does not patch `globalThis.fetch`, and it works in Vitest and Jest. Import it in test files only. On Deno or other JSR consumers, import from `jsr:@haihv/valifetch/mock`.

```ts
import { createMock } from 'valifetch/mock';
import valifetch from 'valifetch';

const mock = createMock();

// Register fixture responses
mock.get('/users').reply(200, [{ id: 1, name: 'Alice' }]);
mock.post('/users').reply(201, { id: 2, name: 'Bob' });

// Attach to an instance
const api = valifetch.extend({ hooks: mock.hooks });

// Make requests normally: matched routes never reach the network
const users = await api.get('https://api.example.com/users');
```

Because the mock is a hook, a mocked `Response` still flows through the real pipeline: status checking, parsing, schema validation and `afterResponse` hooks all run, so your tests exercise your schemas too.

## Handlers

`get`, `post`, `put`, `patch`, `delete`, `head` and `options` register a handler for that method; `when(method, pattern)` takes `'*'` for any method. Each returns a `MockHandler` with `reply` and `replyOnce`.

```ts
mock.get('/users/:id').reply(200, { id: 1 }); // :param wildcard
mock.get('/files/*').reply(200, { file: true }); // * wildcard
mock.get(/\/posts\/\d+$/).reply(200, { post: true }); // RegExp, tested against the full URL
mock.when('*', '/ping').reply(200, { ok: true }); // any method
```

`reply(status, body?, headers?)` registers a permanent fixture. Bodies are always `JSON.stringify`-serialised. Omit the body for a bodyless response such as a 204. Status codes that must not carry a body per the HTTP spec (101, 204, 205, 304) always produce a bodyless response regardless of the `body` argument.

## Response queuing with replyOnce

`replyOnce` registers a response that is consumed on its first match. Combine it with `reply` to script a sequence across consecutive calls:

```ts
mock
  .get('/flaky')
  .replyOnce(503, { error: 'Service Unavailable' }) // first call -> 503
  .reply(200, { data: 'ok' }); // subsequent calls -> 200
```

::: warning Mocks bypass the retry loop
The mock answers from a `beforeRequest` hook, which runs once per call before the fetch-and-retry loop. A mocked 503 is therefore **not** retried by the `retry` option; each call to `api.get()` consumes one queued response. Test your own retry-at-the-call-site logic with `replyOnce`, and test valifetch's retry behaviour against a real server or a stubbed `fetch`.
:::

## Asserting on calls

```ts
const call = mock.lastCall();
console.log(call?.method); // 'GET'
console.log(call?.url); // 'https://api.example.com/users'
console.log(call?.headers); // { 'content-type': 'application/json', ... }
console.log(call?.body); // parsed request body (JSON object, string, or null)
console.log(call?.searchParams); // URLSearchParams

mock.calls(); // all recorded calls in order
mock.lastCall(); // last recorded call, or undefined
```

Each `MockCall` has `method`, `url`, `headers`, `body` and `searchParams`.

## Resetting between tests

```ts
import { afterEach } from 'vitest';

afterEach(() => {
  mock.reset(); // clears handlers and recorded calls
});
```

## A complete test

```ts
import { beforeEach, expect, it } from 'vitest';
import valifetch from 'valifetch';
import { createMock } from 'valifetch/mock';
import * as v from 'valibot';

const UserSchema = v.object({ id: v.number(), name: v.string() });

const mock = createMock();
const api = valifetch.extend({ hooks: mock.hooks });

beforeEach(() => mock.reset());

it('creates a user', async () => {
  mock.post('/users').reply(201, { id: 2, name: 'Bob' });

  const user = await api.post('https://api.example.com/users', {
    json: { name: 'Bob' },
    responseSchema: UserSchema,
  });

  expect(user).toEqual({ id: 2, name: 'Bob' });
  expect(mock.lastCall()?.body).toEqual({ name: 'Bob' });
});

it('rejects a response that does not match the schema', async () => {
  mock.get('/users/1').reply(200, { id: 'nope' });

  await expect(
    api.get('https://api.example.com/users/1', { responseSchema: UserSchema })
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
```

See the [`valifetch/mock` API reference](/api/mock/) for the full type definitions.
