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
- **Hooks** - `beforeRequest`, `afterResponse`, and `afterParseResponse` interceptors
- **Instances** - Create configured instances with `create()` and `extend()`
- **Minimal** - Tree-shakeable, valibot as peer dependency, ~17KB bundle
- **Lightweight Instances** - Shared prototype pattern: each instance has only 1-2 own properties
- **Callable Syntax** - Optional ky-style `api('/users')` syntax via `callable()` wrapper

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

### Instance Functions

```typescript
// Create a new instance
valifetch.create(options);

// Extend an instance
instance.extend(options);
instance.extend((parentOptions) => newOptions);

// Wrap instance for callable syntax
instance.callable();
```

### Options

```typescript
type Options = {
  // Schema validation
  responseSchema?: Schema; // Validate response JSON
  bodySchema?: Schema; // Validate request body
  paramsSchema?: Schema; // Validate path parameters
  searchSchema?: Schema; // Validate search/query parameters

  // Request data
  json?: object; // JSON body (auto-stringified, sets Content-Type: application/json)
  form?: FormData | URLSearchParams | Record<string, string>; // Form body — FormData → multipart/form-data; URLSearchParams/object → application/x-www-form-urlencoded
  params?: object; // Path parameters for :param replacement
  searchParams?: string | URLSearchParams | Record<string, string | number | boolean | null | undefined> | Array<[string, string | number | boolean]>; // Query string parameters
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'; // HTTP method (for callable syntax)

  // Response format
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'stream' | 'raw';

  // Configuration
  prefixUrl?: string; // Base URL prefix
  timeout?: number; // Request timeout in ms
  retry?: RetryOptions | number | false; // Retry configuration
  validateResponse?: boolean; // Enable response validation (default: true)
  validateRequest?: boolean; // Enable request validation (default: true)
  throwHttpErrors?: boolean; // Throw on non-2xx status (default: true)
  dedupe?: boolean; // Deduplicate concurrent identical requests (default: false)
  onDownloadProgress?: (event: DownloadProgressEvent) => void; // Download progress callback (not called for responseType 'stream' or 'raw')

  // Hooks
  hooks?: {
    beforeRequest?: BeforeRequestHook[];
    afterResponse?: AfterResponseHook[];
    afterParseResponse?: AfterParseResponseHook[];
  };

  // Standard fetch options
  headers?: HeadersInit;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  // ... other RequestInit options
};
```

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

### Hooks

```typescript
const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  hooks: {
    beforeRequest: [
      (request, options) => {
        console.log('Request:', request.method, request.url);
        // Optionally return modified Request or Response to bypass fetch
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
  },
});
```

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

Retry applies to both HTTP error responses (matching `statusCodes`) and network-level errors (e.g. `TypeError: Failed to fetch`). In both cases the same `methods` guard applies — non-idempotent methods like `POST` and `PATCH` are not retried by default to prevent duplicate submissions.

### Timeout & Cancellation

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

When `dedupe: true`, concurrent requests with the same method and URL share a single in-flight promise. Subsequent calls made before the first resolves reuse the same request rather than firing a new one.

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
```

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

> **Note:** `onDownloadProgress` is not called when `responseType` is `'stream'` or `'raw'`, because in those modes the caller takes direct ownership of the response body.

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

## Tree-Shaking & Subpath Imports

Valifetch is fully tree-shakeable. For minimal bundle size, you can import just what you need:

```typescript
// Main import - includes everything
import valifetch, { ValifetchError } from 'valifetch';

// Subpath import - just the error class
import { ValifetchError } from 'valifetch/error';

// Subpath import - just types (no runtime code)
import type {
  ValifetchOptions,
  RetryOptions,
  BeforeRequestHook,
  AfterResponseHook,
  AfterParseResponseHook,
  CallableInstance,
} from 'valifetch/types';
```

The package uses code splitting internally, so shared code between entry points is only loaded once.

## Requirements

- Node.js >= 20.0.0 (uses native fetch)
- valibot >= 1.0.0

## Contributing

Issues and PRs welcome!

## License

[MIT](LICENSE)
