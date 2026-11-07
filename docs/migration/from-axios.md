# Migrating from axios

axios and valifetch differ at the root: valifetch is built on native `fetch`, resolves to the **parsed body** rather than a response wrapper, and validates with Valibot.

## The shape of a call

::: code-group

```ts [axios]
import axios from 'axios';

const { data } = await axios.get<User>('https://api.example.com/users/1');
```

```ts [valifetch]
import valifetch from 'valifetch';

const user = await valifetch.get('https://api.example.com/users/1', {
  responseSchema: UserSchema, // validated and typed
});
```

:::

There is no `{ data, status, headers }` wrapper. When you need the status or headers, use `responseType: 'raw'` to get the `Response`, or read them in an `afterResponse` hook.

## Config options

| axios | valifetch | Notes |
|---|---|---|
| `baseURL` | `prefixUrl` | |
| `url` + `method` | the method function (`get`, `post`, ...) or `api(url, { method })` on a `callable()` instance | |
| `params` | `searchParams` | |
| `data` (object) | `json` | Optionally validated by `bodySchema` |
| `data` (`FormData`, `URLSearchParams`) | `form` | |
| `data` (string, `Blob`, `ArrayBuffer`, stream) | `body` | Raw; set `Content-Type` yourself |
| `headers` | `headers` | |
| `timeout` | `timeout` | Milliseconds; `0` disables |
| `withCredentials: true` | `credentials: 'include'` | Standard fetch option |
| `auth: { username, password }` | `basicAuth(user, pass)` from `valifetch/auth` | |
| `responseType: 'json'` | default | |
| `responseType: 'text'` | `responseType: 'text'` | |
| `responseType: 'blob'` | `responseType: 'blob'` | |
| `responseType: 'arraybuffer'` | `responseType: 'arrayBuffer'` | Different casing |
| `responseType: 'stream'` | `responseType: 'stream'` | Returns a web `ReadableStream` |
| `validateStatus` | `throwHttpErrors: boolean` | A boolean only; no custom predicate |
| `signal` | `signal`, or `.cancel()` on the returned promise | |
| `cancelToken` | `.cancel()` / `signal` | |
| `onDownloadProgress` | `onDownloadProgress` | Event is `{ loaded, total, percent }` |
| `onUploadProgress` | none | See [File upload](/recipes/file-upload) |
| `transformRequest` | `beforeRequest` hook | |
| `transformResponse` | `afterParseResponse` hook | |
| `interceptors.request` | `hooks.beforeRequest` | |
| `interceptors.response` | `hooks.afterResponse` / `hooks.afterParseResponse` | |
| `axios.create(config)` | `valifetch.create(options)` | |
| `instance.defaults` mutation | `instance.extend(options)` | Instances are immutable; extend to derive |
| `axios.all([...])` | `api.all([...])` | Typed tuple, cancellable |
| (none) | `responseSchema`, `bodySchema`, `paramsSchema`, `searchSchema` | Validation |
| (none) | `params` with `:name` path segments | |
| (none) | `retry`, `dedupe`, `debug`, `priority` | |
| `paramsSerializer`, `proxy`, `httpAgent` / `httpsAgent`, `maxRedirects`, `maxContentLength`, `decompress` | none | Node-specific transport options are not exposed; valifetch uses the global `fetch` |

## Interceptors become hooks

::: code-group

```ts [axios]
axios.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${getToken()}`;
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await refresh();
      return axios.request(error.config);
    }
    throw error;
  }
);
```

```ts [valifetch]
import valifetch from 'valifetch';
import { bearerAuth } from 'valifetch/auth';

const api = valifetch.create({
  hooks: {
    beforeRequest: [bearerAuth(getToken)],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 401) return response;
        await refresh();
        const headers = new Headers(request.headers);
        headers.set('Authorization', `Bearer ${getToken()}`);
        return fetch(request, { headers });
      },
    ],
  },
});
```

:::

Differences worth knowing:

- Hooks are **arrays** under `hooks`, not registered with `.use()`, and there is no eject. Build a new instance with `extend()` instead.
- Hooks from a parent and a child instance **concatenate**, parent first.
- In axios, the response error handler only sees failures. In valifetch, `afterResponse` sees **every** response, including 4xx and 5xx, *before* the status check. That is why the 401 replay above works without a `try/catch`.
- See [Authentication](/recipes/auth) for `jwtRefresh`, which refreshes proactively.

## Errors

axios throws `AxiosError` for HTTP failures. valifetch throws a single `ValifetchError` with a `code`:

| axios | valifetch |
|---|---|
| `axios.isAxiosError(e)` | `e instanceof ValifetchError` |
| `error.response?.status` | `error.status` |
| `error.response?.data` | `error.responseBody` (parsed JSON, or text) |
| `error.response` | `error.response` |
| `error.code === 'ECONNABORTED'` (timeout) | `error.code === 'TIMEOUT_ERROR'` or `error.isTimeoutError` |
| `axios.isCancel(e)` | `error.code === 'ABORT_ERROR'` or `error.isAbortError` |
| no response (network failure) | `error.code === 'NETWORK_ERROR'` |
| (none) | `error.code === 'VALIDATION_ERROR'`, with `error.target` and `error.issues` |
| (none) | `error.code === 'PARSE_ERROR'` |

```ts
try {
  await api.get('/users/1', { responseSchema: UserSchema });
} catch (error) {
  if (error instanceof ValifetchError) {
    switch (error.code) {
      case 'HTTP_ERROR':
        console.log(error.status, error.responseBody);
        break;
      case 'VALIDATION_ERROR':
        console.log(error.target, error.issues);
        break;
    }
  }
}
```

See [Errors](/guide/errors) for the full table.

## Retry

axios has no built-in retry; it is usually added with a plugin. valifetch retries by default: 2 retries on idempotent methods for `[408, 413, 429, 500, 502, 503, 504]` and on network errors, with exponential backoff and `Retry-After` support. Set `retry: false` to turn it off. See [Retry](/guide/retry).

## Cancellation

```ts
// axios
const controller = new AbortController();
axios.get(url, { signal: controller.signal });
controller.abort();

// valifetch: same signal, or cancel the promise directly
const req = valifetch.get(url);
req.cancel();
```
