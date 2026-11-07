# Authentication

The `valifetch/auth` subpath ships three `beforeRequest` hook factories for the most common auth patterns. They are zero-cost if unused (tree-shaken out entirely) and each returns a plain `BeforeRequestHook`, so they compose freely with any other hooks.

```ts
import valifetch from 'valifetch';
import { bearerAuth, basicAuth, jwtRefresh } from 'valifetch/auth';
```

## bearerAuth

Reads the token on every request, so a rotated token is picked up automatically. If the getter returns `null` or `undefined`, no header is set.

```ts
const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  hooks: { beforeRequest: [bearerAuth(() => localStorage.getItem('token'))] },
});
```

## basicAuth

HTTP Basic auth. The credentials are UTF-8 encoded once, at creation time.

```ts
const adminApi = valifetch.create({
  prefixUrl: 'https://api.example.com',
  hooks: { beforeRequest: [basicAuth('admin', 's3cr3t')] },
});
```

Read secrets from your environment or a secret store; do not hardcode them.

## jwtRefresh

Proactive refresh. Before each request it reads the current token; if there is none or it is expired, it calls `refresh()`, then sets the `Authorization` header. Concurrent requests share a single in-flight refresh, so only one refresh call is made.

```ts
const authApi = valifetch.create({
  prefixUrl: 'https://api.example.com',
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

The options (`JwtRefreshOptions`) are:

| Option | Type | Purpose |
|---|---|---|
| `getToken` | `() => string \| null \| undefined` | Returns the current access token |
| `isExpired` | `(token: string) => boolean` | Whether the token needs refreshing |
| `refresh` | `() => Promise<string>` | Obtains a new token |
| `onRefreshed` | `(token: string) => void \| Promise<void>` (optional) | Persist the new token |

::: warning Avoid a refresh loop
In the example above, the refresh call goes through `authApi` itself, so the `/auth/refresh` request would also trigger `jwtRefresh`. Make sure `getToken` / `isExpired` do not report the refresh endpoint as needing a token, or call refresh through a separate instance that does not have the hook.
:::

## Refresh on 401 with afterResponse

When you cannot know expiry up front, react to the 401 instead: an `afterResponse` hook can fetch a new token and replay the request. Returning a `Response` replaces the original for parsing and validation, and short-circuits the remaining `afterResponse` hooks.

```ts
import valifetch from 'valifetch';
import { bearerAuth } from 'valifetch/auth';

let accessToken = loadToken();

const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  hooks: {
    beforeRequest: [bearerAuth(() => accessToken)],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 401) return response;

        accessToken = await refreshAccessToken();

        // Replay the original request with the new token
        const headers = new Headers(request.headers);
        headers.set('Authorization', `Bearer ${accessToken}`);
        return fetch(request, { headers });
      },
    ],
  },
});
```

The replayed response flows through the rest of the pipeline: the status check, parsing, schema validation, and `afterParseResponse`. To avoid several concurrent 401s each starting a refresh, share the refresh promise:

```ts
let refreshing: Promise<string> | null = null;

function refreshOnce(): Promise<string> {
  refreshing ??= refreshAccessToken().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
```

::: tip
`request` in the hook may already have been sent, so a body that is a `ReadableStream` cannot be replayed. For JSON bodies, `fetch(request, ...)` on the hook's request works because valifetch clones requests before sending.
:::
