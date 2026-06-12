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
        onRefreshed: (token) => store.setToken(token),
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

When a retryable response includes a `Retry-After` header (e.g. on a 429), valifetch automatically uses the server-prescribed delay instead of the exponential backoff formula. Both integer-seconds (`Retry-After: 120`) and HTTP-date formats are supported.

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
      console.log(e.validation?.target); // 'response' | 'body' | 'params' | 'search'
      console.log(e.validation?.input);  // the invalid data that was validated
    } else if (e.code === 'TIMEOUT_ERROR') {
      // request exceeded timeout
    } else if (e.code === 'NETWORK_ERROR') {
      // fetch failed (offline, DNS, etc.)
    } else if (e.code === 'ABORT_ERROR') {
      // cancelled via .cancel() or AbortController
    } else if (e.code === 'PARSE_ERROR') {
      // JSON parse failed
    }
    // Boolean shorthands: e.isHttpError, e.isValidationError, e.isTimeoutError,
    //                     e.isNetworkError, e.isAbortError, e.isParseError
  }
}
```

## Key options reference

| Option | Purpose |
|---|---|
| `responseSchema` | Validate + type the response |
| `bodySchema` | Validate `json` body |
| `paramsSchema` | Validate `:name` path params |
| `searchSchema` | Validate query params |
| `json` | JSON request body |
| `form` | FormData / URLSearchParams / Record\<string, string\> (plain object values must be strings) |
| `params` | Path param values |
| `searchParams` | Query string |
| `prefixUrl` | Base URL for the instance |
| `timeout` | Ms until TIMEOUT_ERROR |
| `retry` | `{ limit, statusCodes, methods, delay }` or just a number |
| `responseType` | `'json'` (default) \| `'text'` \| `'blob'` \| `'arrayBuffer'` \| `'formData'` \| `'stream'` \| `'raw'` \| `'sse'` |
| `validateResponse` | Validate response against `responseSchema` (default: `true`) |
| `validateRequest` | Validate body/params/search schemas (default: `true`) |
| `dedupe` | Collapse concurrent identical requests into one |
| `throwHttpErrors` | Default `true`; set `false` to handle non-2xx manually |
| `debug` | `true` (console.debug) or `(event: DebugEvent) => void` — lifecycle logging |
| `hooks` | `{ beforeRequest, afterResponse, afterParseResponse }` |

## What NOT to do

- Don't call `.json()` on the result — valifetch parses JSON automatically
- Don't use `responseType: 'stream'` or `'sse'` then also set `responseSchema` — they're incompatible
- Don't set both `json` and `form` on the same request
- Don't look for a generic `body` option — use `json` (validated against `bodySchema`) or `form`; the native `body` is intentionally removed
- Don't pass `responseType` to `create()` / `extend()` — it's per-call only, because it changes each call's return type
- Don't use `responseSchema` with `head()` — it always returns `void` regardless
- Don't import from `valifetch/types` at runtime — it contains zero runtime code; use `import type` only

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
- `method` — HTTP method string
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
