---
description: "Migrate from ky to valifetch: option and hook mapping for ky 1.x and 2.x, parsed-data return values and Valibot validation."
---

# Migrating from ky

valifetch is deliberately close to [ky](https://github.com/sindresorhus/ky): both wrap native `fetch`, both have instances, retries and hooks. The biggest differences are that valifetch **returns parsed data** instead of a response promise with `.json()`, and that it **validates** with Valibot.

::: info Versions
Option names below are shown for ky 1.x and ky 2.x where they differ. ky 2 renamed `prefixUrl` to `prefix` and moved its hooks to state-object arguments; valifetch's hooks use the positional signatures ky 1 had.
:::

## The shape of a call

::: code-group

```ts [ky]
import ky from 'ky';

const user = await ky.get('https://api.example.com/users/1').json<User>();
```

```ts [valifetch]
import valifetch from 'valifetch';

const user = await valifetch.get('https://api.example.com/users/1', {
  responseSchema: UserSchema, // validated and typed
});
// or, without validation:
const user2 = await valifetch.get<User>('https://api.example.com/users/1');
```

:::

| ky | valifetch |
|---|---|
| `.json()` | Default; the call resolves to the parsed JSON |
| `.text()` | `responseType: 'text'` |
| `.blob()` | `responseType: 'blob'` |
| `.arrayBuffer()` | `responseType: 'arrayBuffer'` |
| `.formData()` | `responseType: 'formData'` |
| The `Response` itself (`await ky(...)`) | `responseType: 'raw'` |
| `response.body` | `responseType: 'stream'` |
| `ky.create()` / `ky.extend()` | `valifetch.create()` / `instance.extend()` |
| `ky(url, options)` | `instance.callable()` then `api(url, options)` |

## Options

| ky | valifetch | Notes |
|---|---|---|
| `prefixUrl` (ky 1) / `prefix` (ky 2) | `prefixUrl` | Paths always stay under it: absolute inputs become path segments, a `..` escape throws a `TypeError`, and a prefix with `?` or `#` throws |
| `searchParams` | `searchParams` | Same name. Instance values merge with per-request values; `undefined` / `null` removes a key |
| `json` | `json` | Optionally validated by `bodySchema` |
| `body` (string, `Blob`, stream, `FormData`, ...) | `body` for raw payloads, `form` for `FormData` / `URLSearchParams` | `json`, `form` and `body` are mutually exclusive |
| `headers` | `headers` | |
| `timeout` | `timeout` | `0` disables it (ky uses `false`) |
| `retry: number` / `retry: { limit, methods, statusCodes }` | `retry: number` / `retry: { limit, methods, statusCodes }` | Same names |
| `retry.delay(attemptCount)` | `retry.delay(attempt)` | 0-based; returns milliseconds |
| `retry.shouldRetry` | `retry.shouldRetry` | See [Retry](/guide/retry#shouldretry) for the context shape |
| `retry.maxRetryAfter` | `retry.maxRetryAfter` | Behaviour differs: ky clamps the wait to `maxRetryAfter` and still retries; valifetch skips the retry and surfaces the response (an `HTTP_ERROR`, or the response with `throwHttpErrors: false`). valifetch defaults to `60_000` ms. See [Retry](/guide/retry#maxretryafter) |
| `retry.backoffLimit`, `retry.jitter`, `retry.retryOnTimeout`, `retry.afterStatusCodes` | none | valifetch caps the default backoff at 30 s, adds 20% jitter, and honours `Retry-After` |
| `throwHttpErrors: boolean` | `throwHttpErrors: boolean` | valifetch does not accept a function |
| `hooks` | `hooks` | See below |
| `onDownloadProgress` | `onDownloadProgress` | Event is `{ loaded, total, percent }` |
| `onUploadProgress` (ky 2) | none | See [File upload](/recipes/file-upload) |
| `signal` | `signal`, plus `.cancel()` on the returned promise | |
| `totalTimeout`, `maxResponseSize`, `parseJson`, `stringifyJson`, `fetch`, `context` | none | |
| (none) | `responseSchema`, `bodySchema`, `paramsSchema`, `searchSchema` | Validation |
| (none) | `params` with `:name` path segments | |
| (none) | `dedupe`, `debug`, `priority`, `sseMaxEventSize` | |

## Hooks

The five hook names match ky's, with the addition of `afterParseResponse`. valifetch hooks are plain arrays and use positional arguments.

| ky 1 hook | ky 2 hook argument | valifetch |
|---|---|---|
| `beforeRequest(request, options)` | `({ request, options, retryCount })` | `beforeRequest(request, options)` |
| `afterResponse(request, options, response)` | `({ request, options, response, retryCount })` | `afterResponse(request, options, response)` |
| `beforeRetry({ request, options, error, retryCount })` | same state object | `beforeRetry(state)` where `state` is a `RetryContext` plus `options` |
| `beforeError(error)` | `({ error, ... })` | `beforeError(error)`, receives `ValifetchError` only |
| (none) | (none) | `afterParseResponse(data, response, request)` |
| `init` hooks | `init` hooks | none |

Differences that matter:

- **Short-circuiting `beforeRetry`.** Return the exported `stop` sentinel to give up retrying. Returning a `Request` replaces the request for the remaining attempts.
- **`beforeRequest` runs once per call.** `beforeRetry` runs inside the retry loop.
- **Returning a `Response` from `beforeRequest`** bypasses `fetch` (valifetch's `valifetch/mock` is built on this) and still flows through `afterResponse`.
- **Hooks concatenate on `extend()`**, parent first.
- **Hook errors propagate unwrapped.**

## Errors

| ky | valifetch |
|---|---|
| `HTTPError` (`error.response`) | `ValifetchError` with `code: 'HTTP_ERROR'`; `error.response`, `error.status`, and the already-parsed `error.responseBody` |
| `TimeoutError` | `code: 'TIMEOUT_ERROR'` |
| network `TypeError` | `code: 'NETWORK_ERROR'` |
| `AbortError` | `code: 'ABORT_ERROR'` |
| a JSON parse failure | `code: 'PARSE_ERROR'` |
| (none) | `code: 'VALIDATION_ERROR'` with `error.validation = { target, issues, input }` |

```ts
// ky
try {
  await ky.post(url, { json }).json();
} catch (error) {
  if (error instanceof HTTPError) {
    const body = await error.response.json();
  }
}

// valifetch: the body is already parsed
try {
  await valifetch.post(url, { json });
} catch (error) {
  if (error instanceof ValifetchError && error.isHttpError) {
    const body = error.responseBody;
  }
}
```

## A worked example

::: code-group

```ts [ky]
const api = ky.create({
  prefixUrl: 'https://api.example.com',
  timeout: 10_000,
  retry: { limit: 3 },
  hooks: {
    beforeRequest: [
      (request) => request.headers.set('Authorization', `Bearer ${token()}`),
    ],
  },
});

const users = (await api
  .get('users', { searchParams: { page: 1 } })
  .json()) as User[];
```

```ts [valifetch]
import valifetch from 'valifetch';
import { bearerAuth } from 'valifetch/auth';
import * as v from 'valibot';

const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  timeout: 10_000,
  retry: { limit: 3 },
  hooks: { beforeRequest: [bearerAuth(token)] },
});

const users = await api.get('/users', {
  searchParams: { page: 1 },
  responseSchema: v.array(UserSchema),
});
```

:::

Note the leading `/` is fine in valifetch: `prefixUrl` and the path are joined with the slashes normalised.
