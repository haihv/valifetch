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

### v0.7.0 — Parallel Requests

- **`all()` / `allSettled()`** — cancellable parallel helpers that preserve each element's type (sugar over `Promise.all` / `Promise.allSettled`); `.cancel()` aborts every input that exposes `.cancel()`.
- **Type-export alignment** — consistent types across the `.`, `./types`, and `./error` entry points.
- **`ValifetchError.cause` widened to `unknown`** — matches the standard `Error.cause`; the 1.0 API decisions are documented in the README.

---

## 🚧 Planned

### v0.8.0 — Interception, Retry Depth & API Stabilization _(next release)_

**Theme:** Close the remaining interception gaps and lock the public surface in the same release — the API stabilization work pulled forward from the old v0.9.0 plan, while breaking changes can still land pre-1.0.

**Interception & retry depth**

- ✅ **`beforeRetry` / `beforeError` hooks** — observe or short-circuit a pending retry; transform an error before it is thrown. Shipped on `main`.
- **`shouldRetry` predicate** (planned) — a `RetryOptions.shouldRetry?(ctx)` callback to retry on custom logic (response body, headers) beyond status code and method.
- **Raw request bodies** (planned) — send a `Blob`, `ArrayBuffer`, `ReadableStream`, or `string` with an explicit `Content-Type`, alongside the existing typed `json` / `form` paths.

**API stabilization (pulled forward from v0.9.0)**

- ✅ **API audit** — reviewed option names, hook signatures, error codes, default values, and subpath exports for consistency and ergonomics. Landed as: `extend()` now inherits/applies every instance option; instance-level `searchParams` and `onDownloadProgress` now work; `form`/`signal` are request-only (removed from instance options); dedupe now keys on the fully-resolved URL + method, per instance; `NormalizedOptions` reflects what hooks actually receive; callable-instance typing now matches the verb methods (`api(url, { method, responseType })`, `callable().head()`); `valifetch/types` is the superset entry point for every public type; `PARSE_ERROR` now covers `text`/`blob`/`arrayBuffer`/`formData` reads, not just JSON.
- ✅ **Deprecation pass** — reviewed every public symbol; nothing needed an `@deprecated` tag. Options that were broken-but-typed (silently dropped or ignored) were removed outright rather than deprecated, since they never worked correctly.
- ✅ **Breaking changes** — see the `[Unreleased]` section of `CHANGELOG.md` for the full list (dedupe keying, request-only `form`/`signal`, `NormalizedOptions` shape, `PARSE_ERROR` scope, `MockCall.method` type, etc.).

### v1.0.0 — Stable Release

**Theme:** Production confidence. API locked under semver. v0.8.0 is the last minor release before 1.0 — no further breaking changes are planned.

- **Documentation site** (VitePress) — full API reference generated from JSDoc, migration guides, and recipes for common patterns (auth, SSE, mocking, pagination).
- **Browser compatibility** — Playwright smoke tests against Chrome, Firefox, and Safari to guard against regressions on browser-native `fetch` behaviour.
- **Security audit** — review hook composition for prototype pollution, `prefixUrl` for open-redirect / SSRF, and header merging for injection vectors.
- **Semver policy** — document what constitutes a breaking change (hook signatures, option types, error codes, subpath exports).
- **JSR subpath entries (`auth`, `mock`)** — evaluate publishing them on JSR without dropping the 100% documentation score.
- **`createMock({ strict, prefixUrl })` options** — evaluate stricter mock matching and a `prefixUrl`-scoped mock instance.

---

## Out of scope (pre-1.0)

These were considered and explicitly deferred or rejected:

| Feature | Reason |
|---|---|
| `onUploadProgress` | Native `fetch` exposes no upload progress events; feasible only via `XMLHttpRequest`, which contradicts the fetch-native design. |
| Response caching | Higher-level concern; belongs in SWR / TanStack Query, not an HTTP client. |
