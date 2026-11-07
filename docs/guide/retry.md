# Retry

valifetch retries failed requests with exponential backoff and jitter. Retry applies to both HTTP error responses (matching `statusCodes`) and network-level errors (for example `TypeError: Failed to fetch`).

## Configuration

```ts
const api = valifetch.create({
  retry: {
    limit: 3, // Max retry attempts
    methods: ['GET', 'PUT'], // Methods to retry (also guards network-error retries)
    statusCodes: [408, 429, 500, 502, 503, 504], // Status codes to retry
    delay: (attempt) => Math.min(1000 * 2 ** attempt, 30000), // Backoff in ms
    // Custom predicate: overrides the statusCodes/methods verdict
    shouldRetry: async ({ reason, response }) => {
      // Network failures: retry POSTs too (this API is idempotent by request id)
      if (reason === 'network') return true;
      // Retry a 409 only when the server says the version was stale
      if (response.status === 409) {
        const body = await response.clone().json();
        return body.code === 'STALE_VERSION';
      }
      return undefined; // defer to statusCodes + methods
    },
  },
});

// Or just set the limit
const api2 = valifetch.create({ retry: 5 });

// Disable retry
const api3 = valifetch.create({ retry: false });
```

## Defaults

| Option | Default |
|---|---|
| `limit` | `2` |
| `methods` | `['GET', 'PUT', 'HEAD', 'DELETE', 'OPTIONS']` |
| `statusCodes` | `[408, 413, 429, 500, 502, 503, 504]` |
| `delay(attempt)` | `0.3 * 2 ** attempt` seconds plus up to 20% random jitter, capped at 30 s (about 0.3 s, 0.6 s, 1.2 s, ...) |

Non-idempotent methods such as `POST` and `PATCH` are not retried by default, to prevent duplicate submissions. The same `methods` guard applies to network-error retries.

## Retry-After

When a retryable response includes a `Retry-After` header (for example on a 429), valifetch uses the server-prescribed delay instead of the exponential backoff formula. Both integer seconds (`Retry-After: 120`) and HTTP-date formats are supported.

## shouldRetry

`shouldRetry(context)` is a custom predicate consulted for every failed response and every network error. The context is:

```ts
type RetryContext = {
  request: Request;
  retryCount: number; // 1-based: 1 = the first retry
} & (
  | { reason: 'status'; response: Response; error?: undefined }
  | { reason: 'network'; error: Error; response?: undefined }
);
```

Return `true` to retry even when `statusCodes` and `methods` would not, `false` to never retry this failure, or `undefined` to defer to the built-in status-code and method check.

- It may be async. The response is passed unconsumed, so `response.clone().json()` is safe.
- It is always bounded by `limit`.
- It is never consulted for a successful (`response.ok`) response.
- It runs **before** the `beforeRetry` hooks; returning `false` skips them entirely.
- A predicate that throws aborts the request with that error.

## beforeRetry

The [`beforeRetry` hook](/guide/hooks#beforeretry) runs before each retry is scheduled. It only runs for failures that are retryable under your config. Return the [`stop` sentinel](#the-stop-sentinel) to give up, a new `Request` to replace the request for the remaining attempts, or nothing to proceed with the normal backoff.

## The stop sentinel

`stop` is exported from `valifetch` as `Symbol.for('valifetch.stop')`. Returning it from a `beforeRetry` hook aborts retrying and treats the original failure as final. Hooks run in order, and returning `stop` short-circuits the remaining ones.

```ts
import valifetch, { stop } from 'valifetch';

const api = valifetch.create({
  hooks: {
    beforeRetry: [
      ({ response, retryCount }) => {
        // Give up early on a second 429 instead of waiting out the backoff
        if (retryCount > 1 && response?.status === 429) return stop;
      },
    ],
  },
});
```

## Counter semantics

The counters use different bases on purpose:

| Value | Base | Meaning |
|---|---|---|
| `RetryOptions.delay(attempt)` | 0-based | `delay(0)` computes the first retry's delay |
| `BeforeRetryState.retryCount` | 1-based | The retry about to be performed |
| `RetryContext.retryCount` | 1-based | The retry about to be performed |
| `DebugEvent` retry `attempt` | 1-based | The retry about to be performed |

## Retrying uploads

Retries re-send the request body: the request is cloned before each attempt. A `ReadableStream` body is teed on clone, which buffers it in memory, so pass `retry: false` for large streamed uploads. See [Requests](/guide/requests#raw-body).
