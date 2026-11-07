# Instances

The default export, `valifetch`, is itself an instance. You create configured instances with `create()` and derive new ones with `extend()`.

```ts
// Create a new instance
valifetch.create(options);

// Extend an instance
instance.extend(options);
instance.extend((parentOptions) => newOptions);

// Wrap an instance for callable syntax
instance.callable();

// Run requests in parallel (typed tuple results; cancellable)
instance.all([req1, req2]);
instance.allSettled([req1, req2]);
```

## create

```ts
const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  timeout: 10_000,
  headers: {
    Authorization: 'Bearer token123',
  },
  retry: {
    limit: 3,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
});

// Now use without prefixUrl
const user = await api.get('/users/1', { responseSchema: UserSchema });
```

Instance options (`ValifetchInstanceOptions`) are the base options minus the request-only ones. `json`, `form`, `body`, `signal` and `window` are request-only and cannot be set on `create()` or `extend()`. `priority` works on both and is forwarded to `fetch` unchanged. `responseType` is per-call only; see [API design decisions](/guide/api-design-decisions).

## extend

`extend()` creates a child instance that inherits the parent's options.

```ts
const adminApi = api.extend({
  headers: { 'X-Admin': 'true' },
});

// Or with a function that receives the parent options
const authApi = api.extend((options) => ({
  ...options,
  headers: {
    ...options.headers,
    Authorization: `Bearer ${getToken()}`,
  },
}));
```

### Option merging

Options from the child are merged over the parent's: plain options set by the child win, while `headers` (merged per header name, case-insensitively, child wins) and `searchParams` combine with the parent's instead of replacing them. `debug` is inherited too, and a child can override it by passing its own value.

### Hooks are concatenated

Hooks from the parent and the child are **concatenated**, with the parent's hooks running first. A child never replaces a parent hook; it adds to the chain.

```ts
const base = valifetch.create({
  hooks: { beforeRequest: [logRequest] },
});

const child = base.extend({
  hooks: { beforeRequest: [addTraceId] },
});
// child runs: logRequest, then addTraceId
```

Merged options are computed lazily on first use and cached, so deeply nested instances stay cheap.

## Callable syntax

For ky-style calls, wrap an instance with `callable()`:

```ts
import valifetch from 'valifetch';

const api = valifetch.create({ prefixUrl: 'https://api.example.com' }).callable();

// Call directly: defaults to GET
const users = await api('/users');

// Specify the method in options
const newUser = await api('/users', {
  method: 'POST',
  json: { name: 'John' },
});

// Or use method shortcuts
const user = await api.get('/users/1');
const created = await api.post('/users', { json: { name: 'Jane' } });

// create() and extend() on a callable instance return callable instances
const adminApi = api.extend({ headers: { 'X-Admin': 'true' } });
await adminApi('/admin/stats');
```

Calling the instance directly with `{ method, responseType, ... }` typechecks like the corresponding verb method would. For example, `api(url, { method: 'GET', responseType: 'blob' })` is typed as `Promise<Blob>`. `callable().head()` does not accept `responseType` or `responseSchema`, matching `ValifetchInstance.head()`.

## Lightweight by design

Instances share a prototype that holds the HTTP methods. Each instance only carries one or two own properties, so creating many of them (for example one per tenant) is cheap.

## Parallel helpers

`all()` and `allSettled()` live on every instance. See [Parallel requests](/recipes/parallel-requests).
