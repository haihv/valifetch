# Valifetch

[![npm version](https://img.shields.io/npm/v/valifetch.svg)](https://www.npmjs.com/package/valifetch)
[![JSR](https://jsr.io/badges/@haihv/valifetch)](https://jsr.io/@haihv/valifetch)
[![npm downloads](https://img.shields.io/npm/dm/valifetch.svg)](https://www.npmjs.com/package/valifetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/haihv/valifetch/actions/workflows/ci.yml/badge.svg)](https://github.com/haihv/valifetch/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/haihv/valifetch/graph/badge.svg)](https://codecov.io/gh/haihv/valifetch)

A type-safe HTTP client built on native `fetch` with [Valibot](https://valibot.dev) schema validation. Like [ky](https://github.com/sindresorhus/ky), but with built-in request/response validation.

## Features

- **Native Fetch** - Zero dependencies on HTTP libraries, uses the native `fetch` API
- **Schema Validation** - Validate response, body, path params, and search params with Valibot
- **Type Inference** - Full TypeScript inference from schemas
- **Auto-parsed Responses** - JSON responses are automatically parsed, no `.json()` needed
- **File Uploads** - Send `FormData`, `URLSearchParams`, or plain objects via the `form` option
- **Path Parameters** - Support for `/users/:id` syntax with validation
- **Retry Logic** - Exponential backoff with jitter for failed requests
- **Timeout & Cancellation** - AbortController support with configurable timeout
- **Download Progress** - Track response body bytes received via `onDownloadProgress`
- **HTTP Error Body** - Server error details auto-attached to `ValifetchError.responseBody` on non-2xx responses
- **Debug Mode** - Structured lifecycle logging via `debug: true` or a custom event handler
- **Hooks** - `beforeRequest`, `afterResponse`, `afterParseResponse`, `beforeRetry`, and `beforeError` interceptors
- **Instances** - Create configured instances with `create()` and `extend()`
- **Minimal** - Tree-shakeable, valibot as peer dependency, ~17KB bundle
- **Lightweight Instances** - Shared prototype pattern: each instance has only 1-2 own properties
- **Callable Syntax** - Optional ky-style `api('/users')` syntax via `callable()` wrapper

## Performance

Benchmarked with [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) on Node.js 20, fetch mocked to eliminate network variance. Run `npm run bench` to reproduce on your machine.

> **Why is ofetch faster on the baseline?** ofetch is a minimal wrapper with no built-in retry, hook system, or schema validation. valifetch bundles all of that — the gap reflects features, not inefficiency. Schema validation itself adds less than 10% overhead over valifetch's own baseline.

### GET + JSON parse (no schema)

| Library | ops/sec | vs valifetch |
|---|---|---|
| ofetch | 204,379 | 1.92× faster |
| **valifetch** | **106,373** | baseline |
| ky | 68,443 | 1.55× slower |
| up-fetch | 44,282 | 2.40× slower |
| axios (fetch adapter) | 36,613 | 2.91× slower |

### GET + JSON parse + schema validation

Only valifetch and up-fetch support schema validation natively. ky, ofetch, and axios would require a manual parse step on top of their baseline cost.

| Library | ops/sec | vs valifetch |
|---|---|---|
| **valifetch + valibot** | **95,703** | baseline |
| up-fetch + valibot | 47,033 | 2.03× slower |

### POST with JSON body

| Library | ops/sec | vs valifetch |
|---|---|---|
| ofetch | 148,444 | 1.80× faster |
| **valifetch** | **82,530** | baseline |
| ky | 47,700 | 1.73× slower |
| up-fetch | 43,303 | 1.91× slower |
| axios (fetch adapter) | 31,562 | 2.61× slower |

### 4xx error path

| Library | ops/sec | vs valifetch |
|---|---|---|
| **valifetch** | **67,548** | baseline |
| ofetch | 58,619 | 1.15× slower |
| up-fetch | 48,718 | 1.39× slower |
| ky | 38,687 | 1.75× slower |
| axios (fetch adapter) | 9,207 | 7.34× slower |

axios constructs a full `AxiosError` with a deep copy of the request config on every error, which explains the 7× gap.

## Installation

**npm / Node.js**

```bash
npm install valifetch valibot
```

**Deno (via JSR)**

```ts
import valifetch from 'jsr:@haihv/valifetch';
```

Or add to `deno.json`:

```bash
deno add jsr:@haihv/valifetch
```

**Bun / other runtimes (via JSR)**

```bash
bunx jsr add @haihv/valifetch
```

## Quick Start

```typescript
import valifetch from 'valifetch';
import * as v from 'valibot';

// Define your schema
const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

// GET with response validation - no .json() needed!
const user = await valifetch.get('https://api.example.com/users/1', {
  responseSchema: UserSchema,
});

// user is fully typed: { id: number; name: string; email: string }
```

## API

### HTTP Methods

```typescript
valifetch.get(url, options);
valifetch.post(url, options);
valifetch.put(url, options);
valifetch.patch(url, options);
valifetch.delete(url, options);
valifetch.head(url, options);
valifetch.options(url, options);
```

> **Note:** `head()` always resolves `void` and does not accept `responseSchema` or `responseType` — the type system rejects them. `get()` and `head()` are bodyless and do not accept `json` or `form`; those stay on `post`/`put`/`patch`/`delete`/`options`.

### Instance Functions

```typescript
// Create a new instance
valifetch.create(options);

// Extend an instance
instance.extend(options);
instance.extend((parentOptions) => newOptions);

// Wrap instance for callable syntax
instance.callable();

// Run requests in parallel (typed tuple results; cancellable)
instance.all([req1, req2]);
instance.allSettled([req1, req2]);
```

### Options

```typescript
type Options = {
  // Schema validation
  responseSchema?: Schema; // Validate response JSON
  bodySchema?: Schema; // Validate request body
  paramsSchema?: Schema; // Validate path parameters
  searchSchema?: Schema; // Validate search/query parameters

  // Request data (request-only — not accepted on create()/extend())
  json?: object; // JSON body (auto-stringified, sets Content-Type: application/json); not accepted on get()/head()
  form?: FormData | URLSearchParams | Record<string, string>; // Form body — FormData → multipart/form-data; URLSearchParams/object → application/x-www-form-urlencoded; not accepted on get()/head()
  params?: object; // Path parameters for :param replacement
  searchParams?: string | URLSearchParams | Record<string, string | number | boolean | null | undefined> | Array<[string, string | number | boolean]>; // Query string parameters — instance value is a default, merged with (and overridden per-key by) the per-request value
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'; // HTTP method (for callable syntax)
  priority?: 'high' | 'low' | 'auto'; // Forwarded to fetch

  // Response format
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'stream' | 'raw' | 'sse';

  // Configuration
  prefixUrl?: string; // Base URL prefix
  timeout?: number; // Request timeout in ms
  retry?: RetryOptions | number | false; // Retry configuration
  validateResponse?: boolean; // Enable response validation (default: true)
  validateRequest?: boolean; // Enable request validation (default: true)
  throwHttpErrors?: boolean; // Throw on non-2xx status (default: true)
  dedupe?: boolean; // Deduplicate concurrent identical requests (default: false)
  onDownloadProgress?: (event: DownloadProgressEvent) => void; // Download progress callback (not called for responseType 'stream', 'raw', or 'sse')
  debug?: true | ((event: DebugEvent) => void); // Structured lifecycle logging (request, response, retry, cancel)

  // Hooks
  hooks?: {
    beforeRequest?: BeforeRequestHook[];
    afterResponse?: AfterResponseHook[];
    afterParseResponse?: AfterParseResponseHook[];
    beforeRetry?: BeforeRetryHook[];
    beforeError?: BeforeErrorHook[];
  };

  // Standard fetch options
  headers?: HeadersInit;
  signal?: AbortSignal; // Request-only — not accepted on create()/extend()
  credentials?: RequestCredentials;
  // ... other RequestInit options
};
```

> **Note:** `form`, `signal`, and `window` are request-only and are omitted from `create()` / `extend()` instance options. `priority` is available on both instance and per-request options and is forwarded to `fetch` unchanged.

## Examples

### Basic Usage

```typescript
// With schema validation - type inferred from schema
const user = await valifetch.get('https://api.example.com/users/1', {
  responseSchema: UserSchema,
});

// With generic type - no runtime validation
const user = await valifetch.get<User>('https://api.example.com/users/1');

// Without type - returns unknown
const data = await valifetch.get('https://api.example.com/data');
```

### Path Parameters

```typescript
const UserParamsSchema = v.object({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

const user = await valifetch.get('https://api.example.com/users/:id', {
  params: { id: 123 },
  paramsSchema: UserParamsSchema,
  responseSchema: UserSchema,
});
```

### POST with Body Validation

```typescript
const CreateUserSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  email: v.pipe(v.string(), v.email()),
});

const newUser = await valifetch.post('https://api.example.com/users', {
  json: { name: 'John', email: 'john@example.com' },
  bodySchema: CreateUserSchema,
  responseSchema: UserSchema,
});
```

### File Uploads & Form Body

```typescript
// Multipart file upload (FormData) — Content-Type is set automatically with the correct boundary
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('name', 'avatar');

await api.post('/upload', { form: formData });

// URL-encoded form — sets Content-Type: application/x-www-form-urlencoded
await api.post('/login', {
  form: { username: 'alice', password: 'secret' },
});

// URLSearchParams also works
await api.post('/login', {
  form: new URLSearchParams({ username: 'alice', password: 'secret' }),
});
```

> **Note:** `form` and `json` are mutually exclusive — only one should be set per request.

### Search Parameters

```typescript
const SearchSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer())),
  limit: v.optional(v.pipe(v.number(), v.integer(), v.maxValue(100))),
  q: v.optional(v.string()),
});

const users = await valifetch.get('https://api.example.com/users', {
  searchParams: { page: 1, limit: 10, q: 'john' },
  searchSchema: SearchSchema,
  responseSchema: v.array(UserSchema),
});
```

Instance-level `searchParams` are appended to any query string already present in the request path — `api.get('/a?x=1')` against an instance created with `{ searchParams: { x: 'i' } }` produces `?x=1&x=i`, not a replacement. A per-request `searchParams` key explicitly set to `undefined` or `null` removes an instance default for that key entirely, rather than leaving it in place.

### Response Types

```typescript
// JSON (default)
const data = await valifetch.get('https://api.example.com/data');

// Text
const html = await valifetch.get('https://example.com', {
  responseType: 'text',
});

// Blob
const image = await valifetch.get('https://example.com/image.png', {
  responseType: 'blob',
});

// Streaming (returns response.body as ReadableStream)
const stream = await valifetch.get('https://example.com/large-file', {
  responseType: 'stream',
});

// Raw Response object
const response = await valifetch.get('https://example.com', {
  responseType: 'raw',
});

// SSE — returns AsyncIterable<MessageEvent>, parses the SSE frame protocol internally
const events = await valifetch.get('https://api.example.com/stream', {
  responseType: 'sse',
});
for await (const event of events) {
  console.log(event.type, event.data); // event.type defaults to 'message'
}
```

### Create an Instance

```typescript
const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  timeout: 10000,
  headers: {
    Authorization: 'Bearer token123',
  },
  retry: {
    limit: 3,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
});

// Now use without prefixUrl
const user = await api.get('/users/1', {
  responseSchema: UserSchema,
});
```

### Extend an Instance

```typescript
const adminApi = api.extend({
  headers: {
    'X-Admin': 'true',
  },
});

// Or with a function
const authApi = api.extend((options) => ({
  ...options,
  headers: {
    ...options.headers,
    Authorization: `Bearer ${getToken()}`,
  },
}));
```

### Callable Syntax

For ky-style syntax where you can call the instance directly:

```typescript
import valifetch from 'valifetch';

const api = valifetch
  .create({
    prefixUrl: 'https://api.example.com',
  })
  .callable();

// Call directly - defaults to GET
const users = await api('/users');

// Specify method in options
const newUser = await api('/users', {
  method: 'POST',
  json: { name: 'John' },
});

// Or use method shortcuts
const user = await api.get('/users/1');
const created = await api.post('/users', { json: { name: 'Jane' } });

// Create and extend return callable instances
const adminApi = api.extend({
  headers: { 'X-Admin': 'true' },
});
await adminApi('/admin/stats');
```

Calling the instance directly with `{ method, responseType, ... }` typechecks like the corresponding verb method would — `api(url, { method: 'GET', responseType: 'blob' })` is typed as `Promise<Blob>`. `callable().head()` does not accept `responseType` or `responseSchema`, matching `ValifetchInstance.head()`.

### Parallel Requests

`all()` runs multiple requests in parallel and resolves to a tuple of their results, with each element's type preserved (sugar over `Promise.all`). It rejects as soon as any request rejects — a rejection does **not** cancel the remaining in-flight requests:

```typescript
const [user, posts] = await api.all([
  api.get('/users/1', { responseSchema: UserSchema }),
  api.get('/posts', { responseSchema: PostsSchema }),
]);
// user: User, posts: Post[]
```

`allSettled()` waits for every request to settle and never rejects — each result is a standard `PromiseSettledResult` (`{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }`, where `reason` is typically a `ValifetchError`):

```typescript
const results = await api.allSettled([api.get('/a'), api.get('/b')]);
for (const r of results) {
  if (r.status === 'fulfilled') console.log(r.value);
  else console.error(r.reason);
}
```

Both return a `CancellablePromise`: calling `.cancel()` aborts every input that exposes a `.cancel()` method (other valifetch requests), and silently ignores plain promises:

```typescript
const batch = api.all([api.get('/a'), api.get('/b')]);
batch.cancel(); // aborts both in-flight requests
```

### Hooks

```typescript
import valifetch, { stop } from 'valifetch';

const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  hooks: {
    beforeRequest: [
      (request, options) => {
        console.log('Request:', request.method, request.url);
        // Optionally return modified Request or Response to bypass fetch.
        // A Response returned here still flows through afterResponse (e.g. valifetch/mock).
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          // Returning a new Response short-circuits remaining afterResponse hooks
          // and replaces the original response for parsing/validation.
          const newToken = await refreshToken();
          return fetch(request, {
            headers: { ...Object.fromEntries(request.headers), Authorization: `Bearer ${newToken}` },
          });
        }
        return response;
      },
    ],
    afterParseResponse: [
      // Transform parsed data - unwrap nested response
      (data) => data.data,
      // Add metadata from response headers
      (data, response) => ({
        ...data,
        _meta: {
          totalCount: response.headers.get('X-Total-Count'),
        },
      }),
    ],
    beforeRetry: [
      ({ request, response, retryCount }) => {
        // Give up early on a second 429 instead of waiting out the backoff
        if (retryCount > 1 && response?.status === 429) return stop;
        // Tag retried attempts so the server can detect duplicates
        return new Request(request, {
          headers: {
            ...Object.fromEntries(request.headers),
            'x-retry-attempt': String(retryCount),
          },
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

`afterParseResponse` does not run for `responseType: 'stream' | 'raw' | 'sse'` (there is no parsed value to transform), and therefore never runs for `head()` either.

Hook signatures are positional and deliberately ky-aligned (`beforeRequest(request, options)`, `afterResponse(request, options, response)`, `afterParseResponse(data, response, request)`, `beforeRetry(state)`, `beforeError(error)`) rather than a single unified state object — see [API Design Decisions](#api-design-decisions). A hook that throws propagates that error as-is and aborts the request; it is never wrapped.

**`beforeRetry`** runs before each retry is scheduled. Return `stop` (exported sentinel) to abort retrying and treat the original failure as final; return a new `Request` to replace the request for all remaining attempts; return nothing (or void) to proceed with the normal backoff. Hooks run in order; returning `stop` short-circuits the remaining hooks. `beforeRetry` only runs for failures that are retryable under your `retry` config (status codes / methods / limit); a hook that throws aborts the request with that error.

**`beforeError`** runs just before any `ValifetchError` is thrown, including `HTTP_ERROR`, `VALIDATION_ERROR`, `PARSE_ERROR`, `TIMEOUT_ERROR`, `ABORT_ERROR`, and `NETWORK_ERROR`. Each hook receives the error and must return it — mutate and return the same instance, or return a replacement. Hooks chain: output of one becomes input to the next.

### Retry Configuration

```typescript
const api = valifetch.create({
  retry: {
    limit: 3, // Max retry attempts
    methods: ['GET', 'PUT'], // Methods to retry (also guards network-error retries)
    statusCodes: [408, 429, 500, 502, 503, 504], // Status codes to retry
    delay: (attempt) => Math.min(1000 * 2 ** attempt, 30000), // Backoff
  },
});

// Or just set the limit
const api2 = valifetch.create({ retry: 5 });

// Disable retry
const api3 = valifetch.create({ retry: false });
```

**Defaults:** `limit: 2`, `methods: ['GET', 'PUT', 'HEAD', 'DELETE', 'OPTIONS']`, `statusCodes: [408, 413, 429, 500, 502, 503, 504]`, `delay(attempt) = 0.3 * 2 ** attempt` seconds plus up to 20% random jitter, capped at 30 s (≈0.3 s, 0.6 s, 1.2 s, …). `RetryOptions.delay(attempt)` is 0-based — `delay(0)` computes the first retry's delay.

Retry applies to both HTTP error responses (matching `statusCodes`) and network-level errors (e.g. `TypeError: Failed to fetch`). In both cases the same `methods` guard applies — non-idempotent methods like `POST` and `PATCH` are not retried by default to prevent duplicate submissions.

When a retryable response includes a `Retry-After` header (e.g. on a 429), valifetch uses the server-prescribed delay instead of the exponential backoff formula. Both integer-seconds (`Retry-After: 120`) and HTTP-date formats are supported.

### Timeout & Cancellation

By default requests never time out — `timeout` is unset. Pass `timeout: 0` to explicitly disable it (equivalent to unset).

```typescript
// Instance-level timeout (applies to every request)
const api = valifetch.create({ timeout: 10_000 });

// Per-request timeout — overrides the instance default for this call only
const user = await api.get('https://api.example.com/users/1', {
  timeout: 2_000, // tight 2 s for a health-check endpoint
  responseSchema: UserSchema,
});

await api.post('/upload', {
  timeout: 60_000, // generous 60 s for a file upload
  form: formData,
});

// Manual cancellation — every request returns a CancellablePromise with .cancel()
const req = valifetch.get('https://api.example.com/slow');
req.cancel(); // aborts immediately; rejects with ValifetchError { code: 'ABORT_ERROR' }

// Or use an AbortController for external control (both cancel() and signal work together)
const controller = new AbortController();
const req2 = valifetch.get('https://api.example.com/slow', {
  signal: controller.signal,
});
controller.abort(); // same effect as req2.cancel()
```

### Deduplication

When `dedupe: true`, concurrent requests with the same method and fully-resolved URL share a single in-flight promise. Subsequent calls made before the first resolves reuse the same request rather than firing a new one. The dedupe key is `method` + the fully-resolved URL (`prefixUrl` + path params + merged `searchParams`, computed from the raw pre-validation values), and the cache is scoped per instance — including instances created via `create()` with no arguments, each of which gets its own cache. Two requests that differ only in search params, or that go through different instances, never collide.

The key deliberately excludes headers, the request body, and schemas — two calls that differ only by header or body are treated as identical and collapsed into one in-flight request. Do not enable `dedupe` for calls that differ only by header or body, and avoid it on non-idempotent methods (POST, PATCH, DELETE) where collapsing distinct requests would be incorrect.

```typescript
const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  dedupe: true,
});

// These two concurrent calls result in only one HTTP request
const [a, b] = await Promise.all([
  api.get('/users/1'),
  api.get('/users/1'),
]);

// Different resolved URLs — two separate requests, not deduped
await Promise.all([
  api.get('/users', { searchParams: { page: 1 } }),
  api.get('/users', { searchParams: { page: 2 } }),
]);
```

> **Caveat:** calling `.cancel()` on a deduped call aborts the single shared request for **every** caller waiting on it, not just the caller that called `.cancel()`.

### Download Progress

Track download progress with the `onDownloadProgress` callback. The callback is fired for each received chunk and receives a `DownloadProgressEvent`.

```typescript
type DownloadProgressEvent = {
  loaded: number;           // bytes received so far
  total: number | undefined; // total bytes (undefined if no Content-Length header)
  percent: number | undefined; // 0–100 (undefined if total is unknown)
};
```

```typescript
const data = await valifetch.get('https://api.example.com/large-file.json', {
  onDownloadProgress: ({ loaded, total, percent }) => {
    if (percent !== undefined) {
      console.log(`Downloaded ${percent.toFixed(1)}% (${loaded}/${total} bytes)`);
    } else {
      console.log(`Downloaded ${loaded} bytes`);
    }
  },
});
```

> **Note:** `onDownloadProgress` is not called when `responseType` is `'stream'`, `'raw'`, or `'sse'`, because in those modes the caller takes direct ownership of the response body. Instance-level `onDownloadProgress` (set on `create()` / inherited via `extend()`) works the same as the per-request option.

### Debug Mode

Enable structured lifecycle logging for development by passing `debug: true` (emits via `console.debug`) or a custom function.

> **Warning:** `debug: true` logs raw `Request` and `Response` objects including headers (e.g. `Authorization`, cookies). Do not enable it in production.

```typescript
// Emit all events to console.debug
const api = valifetch.create({ debug: true });

// Custom handler — full type safety on event
import type { DebugEvent } from 'valifetch/types';

const api = valifetch.create({
  debug: (event: DebugEvent) => {
    if (event.type === 'request') {
      console.log('→', event.request.method, event.request.url);
    } else if (event.type === 'response') {
      console.log('←', event.response.status, `(attempt ${event.attempt})`);
    } else if (event.type === 'retry') {
      console.log(`↺ retry attempt ${event.attempt}, delay ${event.delay}ms, reason: ${event.reason}`);
    } else if (event.type === 'cancel') {
      console.log('✕ cancelled:', event.request.url);
    }
  },
});
```

`DebugEvent` is a discriminated union — the `type` field narrows the payload:

| `type` | Extra fields |
|---|---|
| `'request'` | `request: Request` |
| `'response'` | `request`, `response: Response`, `attempt: number` |
| `'retry'` | `request`, `attempt`, `delay: number`, `reason: 'status' \| 'network'` |
| `'cancel'` | `request` |

> `debug` is inherited by child instances created with `extend()`. A child can override it by passing its own `debug` value.

### Error Handling

```typescript
import { ValifetchError } from 'valifetch';

try {
  const user = await api.get('/users/1', {
    responseSchema: UserSchema,
  });
} catch (error) {
  if (error instanceof ValifetchError) {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        console.log('Validation failed:', error.validation?.issues);
        console.log('Target:', error.validation?.target); // 'response' | 'body' | 'params' | 'search'
        break;
      case 'HTTP_ERROR':
        console.log('HTTP error:', error.response?.status);
        console.log('Error body:', error.responseBody); // parsed JSON or plain text from the server
        break;
      case 'TIMEOUT_ERROR':
        console.log('Request timed out');
        break;
      case 'NETWORK_ERROR':
        console.log('Network error:', error.message);
        break;
      case 'ABORT_ERROR':
        console.log('Request was cancelled');
        break;
      case 'PARSE_ERROR':
        console.log('Failed to parse response:', error.message);
        break;
    }
  }
}
```

| `ErrorCode` | Thrown when | Fields populated |
|---|---|---|
| `HTTP_ERROR` | Response status is non-2xx and `throwHttpErrors` is `true` | `request`, `response`, `responseBody` (parsed JSON, or text if not JSON) |
| `PARSE_ERROR` | Reading/parsing the response body fails (`json`, `text`, `blob`, `arrayBuffer`, or `formData`) | `request`, `response`, `cause` (raw thrown value); `responseBody` = the unparseable raw text, JSON reads only |
| `VALIDATION_ERROR` | A Valibot schema fails (`bodySchema`, `paramsSchema`, `searchSchema`, or `responseSchema`) | `validation: { target, issues, input }`; `request`/`response` are only set when `target === 'response'` — for `body`/`params`/`search` the `Request` doesn't exist yet, so `error.request` is `undefined` |
| `TIMEOUT_ERROR` | The configured `timeout` elapses before a response | `request`, `cause` |
| `ABORT_ERROR` | `.cancel()` or a caller `AbortSignal` aborts the request | `request`, `cause` |
| `NETWORK_ERROR` | `fetch` itself throws (offline, DNS failure, etc.) | `request`, `cause` |

Convenience getters: `error.status` / `error.statusText` (from `error.response`), `error.issues` (`error.validation?.issues ?? []`), `error.target` (`error.validation?.target`, i.e. `'response' | 'body' | 'params' | 'search'`), and the booleans `error.isHttpError`, `error.isValidationError`, `error.isTimeoutError`, `error.isNetworkError`, `error.isAbortError`, `error.isParseError`.

### Disable Validation

```typescript
// Disable for a single request
const data = await api.get('/data', {
  validateResponse: false,
});

// Disable for all requests in an instance
const unsafeApi = valifetch.create({
  validateResponse: false,
  validateRequest: false,
});
```

## TypeScript

Valifetch provides full type inference from your Valibot schemas:

```typescript
import * as v from 'valibot';
import valifetch from 'valifetch';

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
});

// Response type is inferred as { id: number; name: string }
const user = await valifetch.get('/users/1', {
  responseSchema: UserSchema,
});

// Or use generic type without schema (no runtime validation)
type User = { id: number; name: string };
const user2 = await valifetch.get<User>('/users/1');

// Path params are type-checked
await valifetch.get('/users/:id/posts/:postId', {
  params: { id: 1, postId: 2 }, // TypeScript knows these are required
});
```

## Built-in Auth Helpers

The `valifetch/auth` subpath ships three `beforeRequest` hook factories for the most common auth patterns. They are zero-cost if unused (tree-shaken out entirely).

```typescript
import valifetch from 'valifetch';
import { bearerAuth, basicAuth, jwtRefresh } from 'valifetch/auth';

// Bearer token — reads the token on each request
const api = valifetch.create({
  hooks: { beforeRequest: [bearerAuth(() => localStorage.getItem('token'))] },
});

// HTTP Basic auth — credentials encoded once at creation
const adminApi = valifetch.create({
  hooks: { beforeRequest: [basicAuth('admin', 's3cr3t')] },
});

// JWT proactive refresh — refreshes before the request when expired,
// queues concurrent requests so only one refresh call is made
const authApi = valifetch.create({
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

All three factories return a plain `BeforeRequestHook` — they compose freely with any other hooks.

## Testing Utilities (`valifetch/mock`)

The `valifetch/mock` subpath provides `createMock()` — a lightweight mock that intercepts requests via the `beforeRequest` hook, without patching `globalThis.fetch`. Works in Vitest and Jest.

```typescript
import { createMock } from 'valifetch/mock';
import valifetch from 'valifetch';

const mock = createMock();

// Register fixture responses
mock.get('/users').reply(200, [{ id: 1, name: 'Alice' }]);
mock.post('/users').reply(201, { id: 2, name: 'Bob' });

// Attach to an instance
const api = valifetch.extend({ hooks: mock.hooks });

// Make requests normally — matched routes never reach the network
const users = await api.get('https://api.example.com/users');

// Assert on what was sent
const call = mock.lastCall();
console.log(call?.method);      // 'GET'
console.log(call?.url);         // 'https://api.example.com/users'
console.log(call?.headers);     // { 'content-type': 'application/json', ... }
console.log(call?.body);        // parsed request body (JSON object, string, or null)
console.log(call?.searchParams); // URLSearchParams

mock.calls();     // all recorded calls in order
mock.lastCall();  // last recorded call, or undefined

mock.reset();     // clear handlers and calls between tests
```

### URL patterns

```typescript
mock.get('/users/:id').reply(200, { id: 1 });        // :param wildcard
mock.get('/files/*').reply(200, { file: true });      // * wildcard
mock.get(/\/posts\/\d+$/).reply(200, { post: true }); // RegExp (tested against full URL)
mock.when('*', '/ping').reply(200, { ok: true });     // any method
```

### Response queuing

`reply` registers a permanent fixture. `replyOnce` registers one that is consumed on the first match — useful for simulating retries:

```typescript
mock.get('/flaky')
  .replyOnce(503, { error: 'Service Unavailable' }) // first call → 503
  .reply(200, { data: 'ok' });                       // subsequent calls → 200
```

Body values are always `JSON.stringify`-serialised. Pass `undefined` (omit the argument) for a bodyless response (e.g. status 204). Status codes that must not carry a body per the HTTP spec (101, 204, 205, 304) always produce a bodyless response regardless of the `body` argument.

## Tree-Shaking & Subpath Imports

Valifetch is fully tree-shakeable. For minimal bundle size, you can import just what you need:

```typescript
// Main import - includes everything
import valifetch, { ValifetchError } from 'valifetch';

// Subpath import - just the error class
import { ValifetchError } from 'valifetch/error';

// Subpath import - just the auth helpers (zero runtime cost if unused)
import { bearerAuth, basicAuth, jwtRefresh } from 'valifetch/auth';

// Subpath import - testing utilities (import in test files only)
import { createMock } from 'valifetch/mock';

// Subpath import - just types (no runtime code)
import type {
  ValifetchOptions,
  RetryOptions,
  BeforeRequestHook,
  BeforeRetryHook,
  BeforeRetryState,
  BeforeErrorHook,
  AfterResponseHook,
  AfterParseResponseHook,
  CallableInstance,
} from 'valifetch/types';
```

The package uses code splitting internally, so shared code between entry points is only loaded once.

**Entry-point rule:** `valifetch` (`.`) exports the core runtime plus the core types you need day-to-day; `valifetch/types` is the superset — every public type, including the less-common ones like `JwtRefreshOptions`, `MockCall`, `MockHandler`, and `ValifetchMock`. `./error`, `./auth`, and `./mock` are runtime subpaths. On JSR, only the main entry (`.`) is published — `valifetch/auth` and `valifetch/mock` are npm-only for now, to keep the single-entry-point 100% documentation score (see [API Design Decisions](#api-design-decisions)).

## API Design Decisions

A few naming and ergonomics choices are intentional and locked for stability. They are documented here so the asymmetries don't read as accidental:

- **`searchParams` vs `params`.** Query values use `searchParams` (+ `searchSchema`); path values use `params` (+ `paramsSchema`). The `searchParams` key deliberately mirrors the web platform's `URL.searchParams` / `URLSearchParams` and the equivalent option in `ky`, so the value key (`searchParams`) and its schema (`searchSchema`) use slightly different stems. This platform alignment is preferred over internal symmetry.
- **`json` / `form` instead of a generic `body`.** Request bodies are set via `json` (auto-stringified, validated against `bodySchema`) or `form` (`FormData` / `URLSearchParams` / `Record<string, string>`). There is no generic `body` option — the native `body` is intentionally removed via `Omit<RequestInit, 'body'>` so that body handling always goes through the typed, validated path.
- **`responseType` is per-call only.** `responseType` lives on the per-request options, not on `create()` / `extend()` instance options. It changes the **return type** of a call (`'blob'` → `Blob`, `'sse'` → `AsyncIterable<MessageEvent>`, etc.), which cannot be expressed at instance-creation time without losing type safety. Set it on each call instead.
- **`ValifetchError.cause` is `unknown`.** Matching the standard `Error.cause`, the `cause` option accepts any thrown value, not just an `Error`, so non-`Error` throws pass through without wrapping.
- **Hook signatures stay ky-aligned and positional.** `beforeRequest(request, options)`, `afterResponse(request, options, response)`, `afterParseResponse(data, response, request)`, `beforeRetry(state)`, `beforeError(error)` are not being unified into a single state-object signature — matching ky's conventions is deliberate, and a hook that throws propagates that error as-is (never wrapped) to abort the request. `beforeError` only ever sees `ValifetchError`s.
- **Entry-point rule.** `valifetch` (`.`) is the core runtime + core types; `valifetch/types` is the superset of every public type; `./error`, `./auth`, `./mock` are runtime subpaths. JSR publishes a single entry point (`.`) — `auth`/`mock` are npm-only for now.
- **`options(url, requestOptions)`.** The HTTP-verb method is deliberately named `options` (matching the OPTIONS HTTP verb); its parameter is internally named `requestOptions` to avoid colliding with the method name.
- **Retry counters use different bases on purpose.** `RetryOptions.delay(attempt)` is 0-based (`delay(0)` computes the first retry's delay). `BeforeRetryState.retryCount` and the `attempt` field on a `DebugEvent` of type `'retry'` are both 1-based — they describe "the retry about to be performed," which reads more naturally in hook/log code than a 0-based count would.

## Requirements

- Node.js >= 22.0.0 (uses native fetch)
- valibot >= 1.0.0
- TypeScript `moduleResolution: "node16"` (or `"bundler"`/`"nodenext"`) — required to resolve subpath imports like `valifetch/types`, `valifetch/error`, `valifetch/auth`, and `valifetch/mock`

## Contributing

Issues and PRs welcome!

## License

[MIT](LICENSE)
