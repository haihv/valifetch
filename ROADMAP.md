# Roadmap

This document tracks the planned milestones between the current release and **v1.0.0 (stable)**.

---

## v0.6.0 — SSE + Smarter Retry

**Theme:** First-class streaming for AI APIs; retry that respects the server.

- **`responseType: 'sse'`** — returns an `AsyncIterable<MessageEvent>`, parsing the SSE frame protocol internally. Eliminates the need for users to manually parse chunks from `responseType: 'stream'`.
- **`Retry-After` header support** — when a 429 response includes a `Retry-After` header (seconds or HTTP-date), use that delay instead of the exponential backoff formula.

---

## v0.7.0 — Testing Utilities

**Theme:** Make valifetch easy to test in consumer codebases.

- **`valifetch/mock` subpath** — intercept requests by URL pattern and HTTP method, return fixture responses. Works in Vitest and Jest without patching `globalThis.fetch`.
- **Typed call assertions** — `mock.calls()`, `mock.lastCall()` to assert on request headers, body, and params.

---

## v0.8.0 — Errors + Debug Mode

**Theme:** Make failures easier to diagnose.

- **HTTP error body in `ValifetchError`** — on `HTTP_ERROR`, attach the parsed response body (JSON or text) so the server's error detail is not silently discarded.
- **`debug` option** — `debug: true` or `debug: (event) => void` for structured logging of request, response, retry, and cancel lifecycle events. Useful for development without needing a custom hook.

---

## v0.9.0 — API Stabilization

**Theme:** Lock the public surface before 1.0. Last chance for breaking changes.

- **API audit** — review all option names, hook signatures, error codes, and subpath exports for consistency and ergonomics.
- **Deprecation pass** — mark any symbols being removed in 1.0 with `@deprecated` JSDoc.
- **Breaking changes** — any renames, signature adjustments, or removals land here, not in 1.0.

---

## v1.0.0 — Stable Release

**Theme:** Production confidence. API locked under semver.

- **Documentation site** (VitePress) — full API reference generated from JSDoc, migration guides, and recipes for common patterns (auth, SSE, mocking, pagination).
- **Browser compatibility** — Playwright smoke tests against Chrome, Firefox, and Safari to guard against regressions on browser-native `fetch` behavior.
- **Security audit** — review hook composition for prototype pollution, `prefixUrl` for open-redirect/SSRF, and header merging for injection vectors.
- **Semver policy** — document what constitutes a breaking change (hook signatures, option types, error codes, subpath exports).

---

## Out of scope (pre-1.0)

These were considered and explicitly deferred or rejected:

| Feature | Reason |
|---|---|
| `onUploadProgress` | Native `fetch` exposes no upload progress events; feasible only via `XMLHttpRequest`, which contradicts the fetch-native design |
| Response caching | Higher-level concern; belongs in SWR / TanStack Query, not an HTTP client |
