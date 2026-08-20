# valifetch — Agent Guide

Quick reference for AI coding agents (Claude Code, Copilot, Cursor, etc.) working in a project that uses valifetch.

## What is valifetch?

Type-safe HTTP client built on native `fetch` with [Valibot](https://valibot.dev) schema validation. It auto-parses JSON, validates request/response against schemas, and infers TypeScript types from those schemas.

## Install

```bash
npm install valifetch valibot
```

## The pattern to reach for

```typescript
import valifetch from 'valifetch';
import * as v from 'valibot';

// 1. Define a schema
const UserSchema = v.object({ id: v.number(), name: v.string() });

// 2. Pass it as responseSchema — the return type is inferred automatically
const user = await valifetch.get('https://api.example.com/users/1', {
  responseSchema: UserSchema,
});
// user: { id: number; name: string }
```

## Create a shared instance (do this at module level)

```typescript
const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  timeout: 10_000,
  headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
});
```

## Common patterns

### GET with schema

```typescript
const user = await api.get('/users/:id', {
  params: { id: 42 },
  responseSchema: UserSchema,
});
```

### POST with body + response validation

```typescript
const created = await api.post('/users', {
  json: { name: 'Alice', email: 'alice@example.com' },
  bodySchema: CreateUserSchema,
  responseSchema: UserSchema,
});
```

### File upload

```typescript
const form = new FormData();
form.append('file', fileBlob, 'avatar.png');
await api.post('/upload', { form });
```

### Raw body (bytes, streams, pre-serialised payloads)

```typescript
// Sent exactly as given — no validation, and you set the Content-Type
await api.put('/blobs/1', {
  body: new Blob([bytes]),
  headers: { 'content-type': 'application/octet-stream' },
});

// ReadableStream — `duplex: 'half'` is added automatically
await api.put('/blobs/1', {
  body: fileStream,
  headers: { 'content-type': 'application/octet-stream' },
});
```

Exactly one of `json` / `form` / `body` per request — setting two or more throws a `TypeError`.

### Auth (bearer token)

```typescript
import { bearerAuth } from 'valifetch/auth';

const api = valifetch.create({
  hooks: { beforeRequest: [bearerAuth(() => getToken())] },
});
```

### JWT proactive refresh

```typescript
import { jwtRefresh } from 'valifetch/auth';

const api = valifetch.create({
  hooks: {
    beforeRequest: [
      jwtRefresh({
        getToken: () => store.accessToken,
        isExpired: (token) => isJwtExpired(token),
        refresh: () => authApi.post('/auth/refresh').then((r) => r.token),
        onRefreshed: (token) => store.setToken(token), // optional; may return a Promise, which is awaited
      }),
    ],
  },
});
```

### Retry on specific status codes

```typescript
const api = valifetch.create({
  retry: { limit: 3, statusCodes: [429, 500, 502, 503, 504] },
});
```

### Custom retry predicate

```typescript
// Custom retry predicate — true = retry, false = never, undefined = defer to
// statusCodes + methods. Consulted for every failed response and network error,
// before `beforeRetry`, always bounded by `limit`. May be async.
const api = valifetch.create({
  retry: {
    limit: 3,
    shouldRetry: async ({ reason, response }) => {
      if (reason === 'network') return true; // retry POSTs on network errors
      if (response.status === 409) {
        return (await response.clone().json()).code === 'STALE_VERSION';
      }
      return undefined;
    },
  },
});
```

`shouldRetry(ctx)` receives `{ request, retryCount, reason, response | error }` (`reason: 'status'` → `response`, `'network'` → `error`, `retryCount` 1-based). Return `true` to retry even when `statusCodes`/`methods` would not, `false` to never retry this failure, `undefined` to defer to the built-in status-code + method check. May be async; always bounded by `limit`; never consulted for an ok response; runs before `beforeRetry` (returning `false` skips those hooks); a throwing predicate aborts the request with that error. The context type is `RetryContext`, also the base of `BeforeRetryState`.

When a retryable response includes a `Retry-After` header (e.g. on a 429), valifetch automatically uses the server-prescribed delay instead of the exponential backoff formula. Both integer-seconds (`Retry-After: 120`) and HTTP-date formats are supported.

### Interrupt retry or transform errors

```typescript
import valifetch, { stop } from 'valifetch';

const api = valifetch.create({
  hooks: {
    beforeRetry: [
      ({ request, response, retryCount }) => {
        // Give up early on a second 429 instead of waiting out the backoff
        if (retryCount > 1 && response?.status === 429) return stop;
        // Tag retried attempts so the server can detect duplicates
        return new Request(request, {
          headers: { ...Object.fromEntries(request.headers), 'x-retry-attempt': String(retryCount) },
        });
      },
    ],
    beforeError: [
      (error) => {
        error.message = `[api] ${error.message}`;
        return error;
      },
    ],
  },
});
```

`beforeRetry` only runs for failures that are retryable under your `retry` config (status codes / methods / limit) — a 401 never triggers it. A hook that throws aborts the request with that error, propagated as-is (never wrapped). `beforeError` only ever sees `ValifetchError`s. Hook signatures are positional and ky-aligned: `beforeRequest(request, options)`, `afterResponse(request, options, response)`, `afterParseResponse(data, response, request)`, `beforeRetry(state)`, `beforeError(error)`. A `beforeRequest` hook that returns a `Response` (e.g. to bypass `fetch`, as `valifetch/mock` does) still flows through `afterResponse` hooks.

### Cancellation

```typescript
// Every request returns a CancellablePromise with .cancel()
const req = api.get('/slow-endpoint', { responseSchema: UserSchema });
req.cancel(); // aborts immediately; rejects with ValifetchError { code: 'ABORT_ERROR' }

// Or use an AbortController
const controller = new AbortController();
const req2 = api.get('/slow-endpoint', { signal: controller.signal });
controller.abort();
```

### SSE / streaming

```typescript
// First-class SSE — returns AsyncIterable<MessageEvent>, parses the SSE frame protocol
const events = await api.get('/events', { responseType: 'sse' });
for await (const event of events) {
  console.log(event.type, event.data); // event.type defaults to 'message'
}

// Raw ReadableStream (manual parsing)
const stream = await api.get('/events', { responseType: 'stream' });
const reader = stream.getReader();
```

### Parallel requests

```typescript
// all() — typed tuple of results; rejects on first failure (sugar over Promise.all)
const [user, posts] = await api.all([
  api.get('/users/1', { responseSchema: UserSchema }),
  api.get('/posts', { responseSchema: PostsSchema }),
]);

// allSettled() — never rejects; standard PromiseSettledResult per request
const results = await api.allSettled([api.get('/a'), api.get('/b')]);

// Both return a CancellablePromise; .cancel() aborts every cancellable input
const batch = api.all([api.get('/a'), api.get('/b')]);
batch.cancel();
```

### Error handling

```typescript
import { ValifetchError } from 'valifetch/error';

try {
  await api.get('/users/1', { responseSchema: UserSchema });
} catch (e) {
  if (e instanceof ValifetchError) {
    if (e.code === 'HTTP_ERROR') {
      console.log(e.status);              // convenience getter for e.response?.status
      console.log(e.statusText);          // convenience getter for e.response?.statusText
      console.log(e.responseBody);        // parsed server error body — only populated on HTTP_ERROR (JSON object or plain text)
    } else if (e.code === 'VALIDATION_ERROR') {
      console.log(e.issues);             // convenience getter for e.validation?.issues ?? []
      console.log(e.target);             // convenience getter for e.validation?.target: 'response' | 'body' | 'params' | 'search'
      console.log(e.validation?.input);  // the invalid data that was validated
      // Request-side validation (target 'body' | 'params' | 'search') has e.request === undefined.
    } else if (e.code === 'TIMEOUT_ERROR') {
      // request exceeded timeout
    } else if (e.code === 'NETWORK_ERROR') {
      // fetch failed (offline, DNS, etc.)
    } else if (e.code === 'ABORT_ERROR') {
      // cancelled via .cancel() or AbortController
    } else if (e.code === 'PARSE_ERROR') {
      // Body read/parse failed — json, text, blob, arrayBuffer, or formData.
      // e.responseBody is the raw unparseable text (JSON reads only); e.cause is the raw thrown value.
    }
    // Boolean shorthands: e.isHttpError, e.isValidationError, e.isTimeoutError,
    //                     e.isNetworkError, e.isAbortError, e.isParseError
  }
}
```

| `ErrorCode` | Thrown when | Fields populated |
|---|---|---|
| `HTTP_ERROR` | non-2xx status, `throwHttpErrors: true` | `request`, `response`, `responseBody` |
| `PARSE_ERROR` | body read/parse failed | `request`, `response`, `cause`; `responseBody` (JSON reads only) |
| `VALIDATION_ERROR` | Valibot schema failed | `validation: { target, issues, input }`; `request`/`response` only set when `target === 'response'` |
| `TIMEOUT_ERROR` | `timeout` elapsed | `request`, `cause` |
| `ABORT_ERROR` | `.cancel()` or signal abort | `request`, `cause` |
| `NETWORK_ERROR` | `fetch` threw | `request`, `cause` |

## Key options reference

| Option | Purpose |
|---|---|
| `responseSchema` | Validate + type the response |
| `bodySchema` | Validate `json` body |
| `paramsSchema` | Validate `:name` path params |
| `searchSchema` | Validate query params |
| `json` | JSON request body; request-only, not on `get()`/`head()` |
| `form` | FormData / URLSearchParams / Record\<string, string\> (plain object values must be strings); request-only — not accepted on `create()`/`extend()`, and not on `get()`/`head()` |
| `body` | Raw body (`RawBody` = string / Blob / ArrayBuffer / ArrayBufferView / ReadableStream\<Uint8Array\>) sent as-is — no validation, no `Content-Type` inference, `duplex: 'half'` added for streams; request-only — not accepted on `create()`/`extend()`, and not on `get()`/`head()` |
| `params` | Path param values |
| `searchParams` | Query string; instance value is a default, per-request value merges on top (request wins per key). Explicit `undefined`/`null` on a request key removes the instance default for that key. Instance defaults are appended to any query string already in the request path, not merged into it. |
| `prefixUrl` | Base URL for the instance |
| `timeout` | Ms until TIMEOUT_ERROR (default: none — never times out; `0` also disables) |
| `retry` | `{ limit, statusCodes, methods, delay, shouldRetry(ctx) }` or just a number. Defaults: `limit: 2`, `methods: ['GET','PUT','HEAD','DELETE','OPTIONS']`, `statusCodes: [408,413,429,500,502,503,504]`, `delay(attempt) = 0.3 * 2**attempt`s + 20% jitter, capped 30s |
| `responseType` | `'json'` (default) \| `'text'` \| `'blob'` \| `'arrayBuffer'` \| `'formData'` \| `'stream'` \| `'raw'` \| `'sse'`; per-call only, not on `create()`/`extend()` |
| `validateResponse` | Validate response against `responseSchema` (default: `true`) |
| `validateRequest` | Validate body/params/search schemas (default: `true`) |
| `dedupe` | Collapse concurrent identical requests into one; key is method + fully-resolved URL (`prefixUrl` + path params + merged `searchParams`, from raw pre-validation values), scoped per instance (each no-arg `create()` gets its own cache). Excludes headers/body/schemas — don't enable for calls that differ only by header/body, and avoid on non-idempotent methods (default: `false`) |
| `throwHttpErrors` | Default `true`; set `false` to handle non-2xx manually |
| `priority` | `'high'` \| `'low'` \| `'auto'` — forwarded to `fetch` unchanged |
| `signal` | `AbortSignal`; request-only — not accepted on `create()`/`extend()` |
| `debug` | `true` (console.debug) or `(event: DebugEvent) => void` — lifecycle logging |
| `hooks` | `{ beforeRequest, afterResponse, afterParseResponse, beforeRetry, beforeError }` |

## What NOT to do

- Don't call `.json()` on the result — valifetch parses JSON automatically
- Don't use `responseType: 'stream'` or `'sse'` then also set `responseSchema` — they're incompatible
- Don't set more than one of `json` / `form` / `body` on the same request — it throws a `TypeError` (a plain `TypeError`, not a `ValifetchError`)
- Don't expect a `Content-Type` to be inferred for `body` — valifetch never sets one for raw bodies; set it yourself
- Don't pass `responseType` to `create()` / `extend()` — it's per-call only, because it changes each call's return type
- Don't use `responseSchema` with `head()` — it always returns `void` regardless
- Don't import from `valifetch/types` at runtime — it contains zero runtime code; use `import type` only
- Don't forget to `return` the error from a `beforeError` hook — the returned value is what gets thrown
- Don't put `json`, `form`, `body`, or `signal` on `create()` / `extend()` instance options — they are request-only and the types reject them
- Don't rely on `options.signal` inside a hook being the caller's raw `AbortSignal` — it's the composed signal (caller signal + the `.cancel()` controller)

## Testing utilities

Use `valifetch/mock` in test files to intercept requests without patching `globalThis.fetch`:

```typescript
import { createMock } from 'valifetch/mock';
import valifetch from 'valifetch';

const mock = createMock();
mock.get('/users').reply(200, [{ id: 1 }]);          // permanent fixture
mock.post('/users').replyOnce(201, { id: 2 });        // consumed once, then falls through

const api = valifetch.extend({ hooks: mock.hooks });  // attach to instance

await api.get('https://api.example.com/users');

mock.calls();      // MockCall[] — all intercepted requests in order
mock.lastCall();   // MockCall | undefined — most recent intercepted request
mock.reset();      // clear handlers and calls (call between tests)
```

`MockCall` fields:
- `method` — `HttpMethod`
- `url` — full request URL
- `headers` — `Record<string, string>`
- `body` — JSON-parsed object, string, or `null` (no body)
- `searchParams` — `URLSearchParams`

URL patterns: exact path string, `:param` wildcard, `*` wildcard, or `RegExp` (tested against full URL).
Method: HTTP method string, or `'*'` to match any method via `mock.when('*', pattern)`.

Unmatched requests fall through to the real `fetch` (no error).

## Subpath imports

```typescript
import valifetch from 'valifetch';                       // default instance + create/extend
import { ValifetchError } from 'valifetch/error';        // error class
import { bearerAuth, basicAuth, jwtRefresh } from 'valifetch/auth'; // auth hooks
import { createMock } from 'valifetch/mock';             // testing mock (test files only)
import type { ValifetchOptions } from 'valifetch/types'; // types only
```
