# Requests

## Options at a glance

```ts
type Options = {
  // Schema validation
  responseSchema?: Schema; // Validate response JSON
  bodySchema?: Schema; // Validate request body
  paramsSchema?: Schema; // Validate path parameters
  searchSchema?: Schema; // Validate search/query parameters

  // Request data (request-only: not accepted on create()/extend())
  json?: object;
  form?: FormData | URLSearchParams | Record<string, string>;
  body?: RawBody;
  params?: object; // Path parameters for :param replacement
  searchParams?: string | URLSearchParams | Record<string, string | number | boolean | null | undefined> | Array<[string, string | number | boolean]>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  priority?: 'high' | 'low' | 'auto'; // Forwarded to fetch

  // Response format (per-call only)
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'stream' | 'raw' | 'sse';

  // Configuration
  prefixUrl?: string; // Paths must stay under it; no `?` or `#` in the prefix
  timeout?: number; // ms
  retry?: RetryOptions | number | false;
  validateResponse?: boolean; // default: true
  validateRequest?: boolean; // default: true
  throwHttpErrors?: boolean; // default: true
  dedupe?: boolean; // default: false
  onDownloadProgress?: (event: DownloadProgressEvent) => void;
  debug?: true | ((event: DebugEvent) => void);
  sseMaxEventSize?: number; // Largest single SSE event buffered, in UTF-16 code units (default: 16 MiB)

  // Hooks
  hooks?: Hooks;

  // Standard fetch options
  headers?: HeadersInit;
  signal?: AbortSignal; // request-only
  credentials?: RequestCredentials;
  // ... other RequestInit options
};
```

Every symbol is documented in the [API reference](/api/index/type-aliases/ValifetchOptions).

## Request bodies

### JSON

`json` is auto-stringified and sets `Content-Type: application/json`. When you pass `bodySchema`, the value is validated first and `json` is typed from the schema's input.

```ts
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

### Form

`form` accepts `FormData`, `URLSearchParams` or a plain string record.

```ts
// Multipart: Content-Type is set automatically with the correct boundary
const formData = new FormData();
formData.append('file', file);
formData.append('name', 'avatar');
await api.post('/upload', { form: formData });

// URL-encoded: sets Content-Type: application/x-www-form-urlencoded
await api.post('/login', {
  form: { username: 'alice', password: 'secret' },
});

await api.post('/login', {
  form: new URLSearchParams({ username: 'alice', password: 'secret' }),
});
```

### Raw body

When a request body is neither JSON nor a form (a pre-serialised payload, a binary blob, a streamed upload) use the `body` escape hatch. It is sent exactly as given. `RawBody` is `string | Blob | ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>`.

```ts
// Pre-serialised payload: set the Content-Type yourself
await api.post('/events', {
  body: '{"type":"ping"}',
  headers: { 'content-type': 'application/json' },
});

// Binary upload
await api.put('/blobs/abc', {
  body: new Blob([bytes]),
  headers: { 'content-type': 'application/octet-stream' },
});

// Streamed upload: `duplex: 'half'` is added automatically
await api.put('/blobs/abc', {
  body: fileStream,
  headers: { 'content-type': 'application/octet-stream' },
});
```

Rules for raw bodies:

- **No validation.** `bodySchema` applies to `json` only.
- **No `Content-Type` inference.** valifetch never sets one for a raw body. The platform `Request` constructor still applies its own spec default for `string` and `Blob` bodies.
- **Mutually exclusive** with `json` and `form`.
- **Request-only**, and rejected on the bodyless methods (`get`, `head`, `delete`, `options`).
- **`duplex: 'half'`** is added automatically for `ReadableStream` bodies, which the runtime requires.
- **Streaming needs runtime support.** `ReadableStream` request bodies work on Node 22+, Chromium-based browsers (over HTTP/2 or newer) and Safari; Firefox does not support them. Where the runtime cannot stream, valifetch throws a `TypeError` before calling `fetch` (instead of the browser silently sending `[object ReadableStream]`). Pass a `Blob`, `ArrayBuffer` or string there.
- **Retries re-send the body.** The request is cloned before each attempt, so `Blob`, `ArrayBuffer` and string bodies re-send identically. A `ReadableStream` body is teed on clone, which buffers the stream in memory. Pass `retry: false` for large streamed uploads if that matters.

::: warning One body per request
`json`, `form` and `body` are mutually exclusive. Setting more than one on a request throws a `TypeError`. Setting none is fine.
:::

## Path parameters

Use `:name` segments in the URL and pass `params`. The names are type-checked; see [TypeScript](/guide/typescript).

```ts
const user = await valifetch.get('https://api.example.com/users/:id', {
  params: { id: 123 },
  paramsSchema: v.object({
    id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  responseSchema: UserSchema,
});
```

Param values are percent-encoded with `encodeURIComponent`, so `/`, `?`, `#` and `\` in a value can never add path segments, a query string or a fragment. The values `.` and `..` cannot be encoded safely (the URL parser resolves dot segments, even percent-encoded ones), so they throw a `TypeError` before any request is sent. Params are looked up as own properties only, so `:constructor` or `:toString` without a matching param throws as missing rather than resolving from `Object.prototype`. A missing (or `null` / `undefined`) param throws an `Error` naming it.

## Search parameters

```ts
const users = await valifetch.get('https://api.example.com/users', {
  searchParams: { page: 1, limit: 10, q: 'john' },
  searchSchema: v.object({
    page: v.optional(v.pipe(v.number(), v.integer())),
    limit: v.optional(v.pipe(v.number(), v.integer(), v.maxValue(100))),
    q: v.optional(v.string()),
  }),
  responseSchema: v.array(UserSchema),
});
```

Instance-level `searchParams` are defaults that are merged with, and overridden per key by, the per-request value. They are appended to any query string already in the request path: `api.get('/a?x=1')` against an instance created with `{ searchParams: { x: 'i' } }` produces `?x=1&x=i`, not a replacement. A per-request key set explicitly to `undefined` or `null` removes the instance default for that key entirely.

## prefixUrl

`prefixUrl` is joined to the request path with trailing and leading slashes normalised, so `prefixUrl: 'https://api.example.com/v1/'` plus `'/users'` gives `https://api.example.com/v1/users`.

With `prefixUrl` set, the request path is always joined *under* the prefix: the final URL keeps the prefix origin, and its path stays under the prefix path.

```ts
const api = valifetch.create({ prefixUrl: 'https://api.example.com/v1' });

await api.get('https://evil.com'); // -> https://api.example.com/v1/https://evil.com
await api.get('/../admin'); // throws TypeError: resolves outside the prefix path
await api.get('/%2e%2e/admin'); // throws TypeError too

valifetch.create({ prefixUrl: 'https://api.example.com/v1?key=1' }).get('/users');
// throws TypeError: prefixUrl must not contain a query string or fragment
```

- Absolute or protocol-relative inputs (`https://evil.com`, `//evil.com`, `\\evil.com`) become path segments under the prefix rather than switching host.
- A path that climbs above the prefix with `..` (including `%2e%2e`) throws a `TypeError` before any request is sent.
- A `prefixUrl` containing a query string or fragment (`?` or `#`) throws a `TypeError`, because the path would otherwise be swallowed into the query. Put default query values in `searchParams` instead.
- Without `prefixUrl`, the input must be a full URL and is used as-is. Validate user-controlled full URLs yourself; see [Security](/guide/security).

## Timeout

By default requests never time out. `timeout` is in milliseconds; pass `0` to disable it explicitly.

```ts
// Instance-level timeout (applies to every request)
const api = valifetch.create({ timeout: 10_000 });

// Per-request timeout overrides the instance default for this call only
const user = await api.get('https://api.example.com/users/1', {
  timeout: 2_000,
  responseSchema: UserSchema,
});
```

When the timeout elapses, the call rejects with `TIMEOUT_ERROR`.

## Cancellation

Every request returns a `CancellablePromise` with a `.cancel()` method. You can also pass your own `AbortSignal`; both work together.

```ts
const req = valifetch.get('https://api.example.com/slow');
req.cancel(); // rejects with ValifetchError { code: 'ABORT_ERROR' }

const controller = new AbortController();
const req2 = valifetch.get('https://api.example.com/slow', {
  signal: controller.signal,
});
controller.abort(); // same effect as req2.cancel()
```

## Deduplication

With `dedupe: true`, concurrent requests with the same method and fully-resolved URL share a single in-flight promise. The key is `method` plus the fully-resolved URL (`prefixUrl`, path params and merged `searchParams`, computed from the raw pre-validation values). The cache is scoped per instance, including instances created via `create()` with no arguments.

```ts
const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  dedupe: true,
});

// One HTTP request, two callers
const [a, b] = await Promise.all([api.get('/users/1'), api.get('/users/1')]);

// Different resolved URLs: two separate requests
await Promise.all([
  api.get('/users', { searchParams: { page: 1 } }),
  api.get('/users', { searchParams: { page: 2 } }),
]);
```

::: warning
The key deliberately excludes headers, the request body and schemas. Two calls that differ only by header or body are collapsed into one in-flight request. Do not enable `dedupe` for such calls, and avoid it on non-idempotent methods (POST, PATCH, DELETE).

Calling `.cancel()` on a deduped call aborts the single shared request for **every** caller waiting on it.
:::

## Priority

`priority: 'high' | 'low' | 'auto'` is forwarded to `fetch` unchanged. It works on both instance and per-request options.

## Disabling validation

```ts
// For a single request
const data = await api.get('/data', { validateResponse: false });

// For every request on an instance
const unsafeApi = valifetch.create({
  validateResponse: false,
  validateRequest: false,
});
```

`validateRequest` covers `bodySchema`, `paramsSchema` and `searchSchema`; `validateResponse` covers `responseSchema`.

## Non-2xx responses

By default a non-2xx status rejects with an `HTTP_ERROR`. Set `throwHttpErrors: false` to skip the status check; the response then goes through the normal parsing (and `responseSchema` validation, if set) like a successful one. See [Errors](/guide/errors).
