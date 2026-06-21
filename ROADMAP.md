# Roadmap

This document tracks the milestones on the path to **v1.0.0 (stable)**.
Shipped milestones are marked ✅; planned milestones may still shift.

---

## ✅ Shipped

### v0.5.0 — Auth + Cancellation

- **`valifetch/auth` subpath** — `beforeRequest` hook factories: `bearerAuth`, `basicAuth`, and `jwtRefresh` (queues concurrent requests during an in-flight refresh).
- **Cancellable requests** — every method returns a `CancellablePromise<T>` with `.cancel()`; a user-provided `signal` and `.cancel()` compose via `AbortSignal.any()`.

### v0.5.1 — Benchmarks

- **Vitest bench suite** covering the core pipeline (request build, response parse, retry, hooks).

### v0.6.0 — Streaming, Errors & Testing

- **`responseType: 'sse'`** — built-in Server-Sent Events frame parsing; returns an async iterable of typed `SseEvent` objects.
- **`Retry-After` support** — on a 429, honour the `Retry-After` header (seconds or HTTP-date) instead of the exponential backoff formula.
- **`responseBody` on `HTTP_ERROR`** — the server's error detail is parsed (JSON → text) and attached to `ValifetchError` so callers need not re-fetch.
- **`debug` lifecycle option** — `debug: true` or `debug: (event) => void` for structured `request` / `response` / `retry` / `cancel` events.
- **`valifetch/mock` subpath** — `createMock()` intercepts requests via the `beforeRequest` hook (no `globalThis.fetch` patching), with per-URL handlers, call history, and `mockOnce`.

---

## 🚧 Planned

### v0.7.0 — Parallel Requests _(next release)_

**Theme:** Ergonomic concurrency.

- **`all()` / `allSettled()`** — cancellable parallel helpers that preserve each element's type (sugar over `Promise.all` / `Promise.allSettled`); `.cancel()` aborts every input that exposes `.cancel()`.
- **Type-export alignment** — consistent types across the `.`, `./types`, and `./error` entry points.
- **`ValifetchError.cause` widened to `unknown`** — matches the standard `Error.cause`; the 1.0 API decisions are documented in the README.

### v0.8.0 — Interception & Retry Depth

**Theme:** Close the remaining interception gaps while the API can still grow additively.

- **`beforeRetry` / `beforeError` hooks** — observe or short-circuit a pending retry; transform an error before it is thrown.
- **`shouldRetry` predicate** — a `RetryOptions.shouldRetry?(ctx)` callback to retry on custom logic (response body, headers) beyond status code and method.
- **Raw request bodies** — send a `Blob`, `ArrayBuffer`, `ReadableStream`, or `string` with an explicit `Content-Type`, alongside the existing typed `json` / `form` paths.

### v0.9.0 — API Stabilization

**Theme:** Lock the public surface. Last chance for breaking changes.

- **API audit** — review option names, hook signatures, error codes, default values, and subpath exports for consistency and ergonomics.
- **Deprecation pass** — mark any symbols being removed in 1.0 with `@deprecated` JSDoc.
- **Breaking changes** — any renames, signature adjustments, or default changes land here, not in 1.0.

### v1.0.0 — Stable Release

**Theme:** Production confidence. API locked under semver.

- **Documentation site** (VitePress) — full API reference generated from JSDoc, migration guides, and recipes for common patterns (auth, SSE, mocking, pagination).
- **Browser compatibility** — Playwright smoke tests against Chrome, Firefox, and Safari to guard against regressions on browser-native `fetch` behaviour.
- **Security audit** — review hook composition for prototype pollution, `prefixUrl` for open-redirect / SSRF, and header merging for injection vectors.
- **Semver policy** — document what constitutes a breaking change (hook signatures, option types, error codes, subpath exports).

---

## Out of scope (pre-1.0)

These were considered and explicitly deferred or rejected:

| Feature | Reason |
|---|---|
| `onUploadProgress` | Native `fetch` exposes no upload progress events; feasible only via `XMLHttpRequest`, which contradicts the fetch-native design. |
| Response caching | Higher-level concern; belongs in SWR / TanStack Query, not an HTTP client. |
