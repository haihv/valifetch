# Hooks

Hooks are interceptors you register under the `hooks` option, as arrays of functions. There are five:

| Hook | Signature |
|---|---|
| `beforeRequest` | `(request, options)` |
| `afterResponse` | `(request, options, response)` |
| `afterParseResponse` | `(data, response, request)` |
| `beforeRetry` | `(state)` |
| `beforeError` | `(error)` |

Signatures are positional and deliberately aligned with ky 1.x's positional form (ky 2 moved to state objects) rather than a single unified state object. See [API design decisions](/guide/api-design-decisions). A hook that throws propagates that error as-is and aborts the request; it is never wrapped.

On `extend()`, parent and child hooks are concatenated with the parent's first. See [Instances](/guide/instances#hooks-are-concatenated).

```ts
import valifetch, { stop } from 'valifetch';

const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  hooks: {
    beforeRequest: [
      (request, options) => {
        console.log('Request:', request.method, request.url);
        // Optionally return a modified Request, or a Response to bypass fetch.
        // A Response returned here still flows through afterResponse (e.g. valifetch/mock).
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          // Returning a new Response short-circuits the remaining afterResponse
          // hooks and replaces the original response for parsing/validation.
          const newToken = await refreshToken();
          return fetch(request, {
            headers: {
              ...Object.fromEntries(request.headers),
              Authorization: `Bearer ${newToken}`,
            },
          });
        }
        return response;
      },
    ],
    afterParseResponse: [
      // Transform parsed data: unwrap a nested response
      (data) => data.data,
      // Add metadata from response headers
      (data, response) => ({
        ...data,
        _meta: { totalCount: response.headers.get('X-Total-Count') },
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

## beforeRequest

`(request, options) => Request | Response | void`. Runs before each fetch. Return a modified `Request` to replace it, or a `Response` to bypass `fetch` entirely; a returned `Response` still flows through `afterResponse`. This is how [`valifetch/mock`](/recipes/testing) and the [auth helpers](/recipes/auth) work. The `beforeRequest` hooks run once per request, while `beforeRetry` hooks run inside the retry loop.

## afterResponse

`(request, options, response) => Response | void`. Runs on the response before status checking and parsing. Returning a new `Response` short-circuits the remaining `afterResponse` hooks and replaces the original for parsing and validation. This is the place for a 401 refresh-and-replay; see [Authentication](/recipes/auth#refresh-on-401-with-afterresponse).

## afterParseResponse

`(data, response, request) => data`. Runs after the body is parsed (and validated). Hooks chain: the output of one is the input of the next. It does **not** run for `responseType: 'stream' | 'raw' | 'sse'` (there is no parsed value to transform), and therefore never runs for `head()` either.

## beforeRetry

`(state) => Request | typeof stop | void`. `state` is a `BeforeRetryState`: the [`RetryContext`](/guide/retry#shouldretry) plus `options`. Runs before each retry is scheduled, and only for failures that are retryable under your `retry` config (status codes, methods and limit, or a `shouldRetry` verdict). Return `stop` to abort retrying and treat the original failure as final; return a new `Request` to replace the request for all remaining attempts; return nothing to proceed with the normal backoff. Hooks run in order; returning `stop` short-circuits the rest. It does not run when a `Retry-After` header asks for longer than `retry.maxRetryAfter`, because that response is not retried; see [Retry](/guide/retry#maxretryafter).

## beforeError

`(error) => ValifetchError`. Runs just before any `ValifetchError` is thrown: `HTTP_ERROR`, `VALIDATION_ERROR`, `PARSE_ERROR`, `TIMEOUT_ERROR`, `ABORT_ERROR` and `NETWORK_ERROR`. Each hook receives the error and must return it, either the same mutated instance or a replacement. Hooks chain: the output of one becomes the input of the next. `beforeError` only ever sees `ValifetchError`s.

## Execution order

```
valifetch.get(url, opts)
  -> buildRequest        URL construction, path params, body/schema validation
  -> beforeRequest       (hooks; may short-circuit with a Response)
  -> fetch + retry loop  timeout, beforeRetry hooks inside the loop
  -> afterResponse
  -> status check        throws HTTP_ERROR on 4xx/5xx with parsed responseBody
  -> parse + validate    JSON parse and optional schema validation
  -> afterParseResponse
  -> beforeError         (only when something threw)
```
