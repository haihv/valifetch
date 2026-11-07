# Getting started

valifetch is a type-safe HTTP client built on native `fetch` with [Valibot](https://valibot.dev) schema validation. It is like [ky](https://github.com/sindresorhus/ky), but with built-in request and response validation.

## Installation

::: code-group

```bash [npm]
npm install valifetch valibot
```

```bash [Deno (JSR)]
deno add jsr:@haihv/valifetch
```

```bash [Bun / other (JSR)]
bunx jsr add @haihv/valifetch
```

:::

In Deno you can also import directly:

```ts
import valifetch from 'jsr:@haihv/valifetch';
```

## Requirements

- Node.js >= 22.0.0 (uses native `fetch`)
- valibot >= 1.0.0 (a peer dependency)
- TypeScript `moduleResolution: "node16"` (or `"bundler"` / `"nodenext"`). This is required to resolve subpath imports like `valifetch/types`, `valifetch/error`, `valifetch/auth` and `valifetch/mock`.

## Your first request

```ts
import valifetch from 'valifetch';
import * as v from 'valibot';

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

const user = await valifetch.get('https://api.example.com/users/1', {
  responseSchema: UserSchema,
});

// user is fully typed: { id: number; name: string; email: string }
```

There is no `.json()` call. JSON responses are parsed automatically, then validated against `responseSchema` when one is given.

Three ways to get a result type:

```ts
// 1. From a schema: validated at runtime, type inferred
const a = await valifetch.get('https://api.example.com/users/1', {
  responseSchema: UserSchema,
});

// 2. From a generic: no runtime validation
type User = { id: number; name: string };
const b = await valifetch.get<User>('https://api.example.com/users/1');

// 3. Nothing: the result is unknown
const c = await valifetch.get('https://api.example.com/data');
```

## HTTP methods

```ts
valifetch.get(url, options);
valifetch.post(url, options);
valifetch.put(url, options);
valifetch.patch(url, options);
valifetch.delete(url, options);
valifetch.head(url, options);
valifetch.options(url, options);
```

::: warning Bodyless methods
`head()` always resolves `void` and does not accept `responseSchema` or `responseType`. `get()` and `head()` do not accept `json`, `form` or `body`. The type signatures of `delete()` and `options()` currently reuse the bodyless option type as well, so they reject those options too; send bodies with `post`, `put` or `patch`.
:::

## Configure once, reuse everywhere

Most apps create an instance with shared defaults:

```ts
const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});

const user = await api.get('/users/1', { responseSchema: UserSchema });
```

Continue with [Instances](/guide/instances), or jump to [Requests](/guide/requests) and [Validation](/guide/validation).

## Where to go next

- [Requests](/guide/requests): bodies, path params, search params, timeouts, cancellation and deduplication.
- [Errors](/guide/errors): the error codes you can catch.
- [Recipes](/recipes/auth): authentication, SSE streaming, mocking, pagination.
- [API reference](/api/): every exported symbol, generated from the source.
