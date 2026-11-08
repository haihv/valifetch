# Roadmap

This document tracks valifetch's milestones. **v1.0.0 (stable)** has shipped; the API is now
covered by semantic versioning (see the README "Versioning & Stability" section).
Shipped milestones are marked ✅; planned items may still shift.

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

### v0.8.0 — Interception, Retry Depth & API Stabilization

**Theme:** Close the remaining interception gaps and lock the public surface in the same release — the API stabilization work pulled forward from the old v0.9.0 plan, while breaking changes can still land pre-1.0.

**Interception & retry depth**

- ✅ **`beforeRetry` / `beforeError` hooks** — observe or short-circuit a pending retry; transform an error before it is thrown.
- ✅ **`shouldRetry` predicate** — a `RetryOptions.shouldRetry?(ctx)` callback to retry on custom logic (response body, headers) beyond status code and method.
- ✅ **Raw request bodies** — a request-only `body` option sending a `string`, `Blob`, `ArrayBuffer`, typed array, or `ReadableStream` as-is with an explicit `Content-Type`, alongside the existing typed `json` / `form` paths.

**API stabilization (pulled forward from v0.9.0)**

- ✅ **API audit** — reviewed option names, hook signatures, error codes, default values, and subpath exports for consistency and ergonomics. Landed as: `extend()` now inherits/applies every instance option; instance-level `searchParams` and `onDownloadProgress` now work; `form`/`signal` are request-only (removed from instance options); dedupe now keys on the fully-resolved URL + method, per instance; `NormalizedOptions` reflects what hooks actually receive; callable-instance typing now matches the verb methods (`api(url, { method, responseType })`, `callable().head()`); `valifetch/types` is the superset entry point for every public type; `PARSE_ERROR` now covers `text`/`blob`/`arrayBuffer`/`formData` reads, not just JSON.
- ✅ **Deprecation pass** — reviewed every public symbol; nothing needed an `@deprecated` tag. Options that were broken-but-typed (silently dropped or ignored) were removed outright rather than deprecated, since they never worked correctly.
- ✅ **Breaking changes** — see the `[0.8.0]` section of `CHANGELOG.md` for the full list (dedupe keying, request-only `form`/`signal`, `NormalizedOptions` shape, `PARSE_ERROR` scope, `MockCall.method` type, etc.).

---

### v1.0.0 — Stable Release

**Theme:** Production confidence. API locked under semver.

- ✅ **Security audit** — prefix containment (`..` / `%2e%2e` escapes and a `prefixUrl` with `?` / `#` throw a `TypeError`), own-key path params with `.` / `..` rejected, prototype-pollution-safe option and header merging, redacted `debug: true` logging (headers and query parameters), strict and bounded `Retry-After` (new `retry.maxRetryAfter`, default 60 s), clamped retry sleeps, a bounded SSE parser (new `sseMaxEventSize`, default 16 MiB) that cancels the body on early exit, and `SECURITY.md` with the threat model.
- ✅ **Semver policy** — the README "Versioning & Stability" section defines the public API and what is major, minor and patch (hook signatures, option types, documented defaults, error codes, subpath exports), condensed in `llms.txt` and `AGENTS.md`.
- ✅ **JSR subpath entries (`auth`, `mock`)** — published as `jsr:@haihv/valifetch/auth` and `jsr:@haihv/valifetch/mock` with the 100% documentation score kept; `./error` and `./types` stay npm-only.
- ✅ **Browser compatibility** — Vitest browser-mode smoke tests against Chromium, Firefox and WebKit via Playwright, in CI. Surfaced that Firefox cannot stream request bodies; a `ReadableStream` body now throws a `TypeError` there instead of being silently corrupted.
- ✅ **Documentation site** (VitePress) — guides, recipes (auth, SSE, mocking, pagination, parallel requests, file upload), migration guides from ky and axios, and an API reference generated from JSDoc with TypeDoc.
- Deferred: **`createMock({ strict, prefixUrl })` options** — evaluated and moved to post-1.0. Both are additive, so they can land in a minor release.

---

## 🚧 Planned

### Post-1.0

All additive or tooling-only, so none needs a major release.

- **`createMock({ strict, prefixUrl })` options** — stricter mock matching and a `prefixUrl`-scoped mock instance.
- **TypeScript 7** — move the toolchain once tsup (or a replacement such as tsdown) can build declarations without the TypeScript compiler API that TypeScript 7 no longer ships.
- **Remove the TypeDoc minimatch shim** (`scripts/typedoc-minimatch-compat.mjs` and the `typedoc` → `minimatch` override) once TypeDoc supports minimatch 11.
- **VitePress 2** — upgrade the docs site, which drops the `vitepress` → `vite` override.

---

## Out of scope

These were considered and explicitly deferred or rejected:

| Feature | Reason |
|---|---|
| `onUploadProgress` | Native `fetch` exposes no upload progress events; feasible only via `XMLHttpRequest`, which contradicts the fetch-native design. |
| Response caching | Higher-level concern; belongs in SWR / TanStack Query, not an HTTP client. |
