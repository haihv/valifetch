# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-06-21

### Added

- **`all()` / `allSettled()` parallel request helpers** — run multiple requests concurrently with full tuple-type preservation (sugar over `Promise.all` / `Promise.allSettled`). The returned promise is cancellable: `.cancel()` aborts every input that exposes a `.cancel()` method. ([#34](https://github.com/haihv/valifetch/pull/34))

### Changed

- **`ValifetchError.cause` widened to `unknown`** — matches the standard `Error.cause` and accepts any thrown value without wrapping. The intentional 1.0 API decisions (`searchParams`/`searchSchema`, `json`/`form` over a generic `body`, per-call `responseType`, `cause: unknown`) are now documented in the README under "API Design Decisions". ([#35](https://github.com/haihv/valifetch/pull/35))

### Fixed

- **Type-export alignment** — the same types are now exported consistently across the `.`, `./types`, and `./error` entry points. ([#33](https://github.com/haihv/valifetch/pull/33))
- Remove a duplicate `form` option and correct stale retry-method documentation in the option types. ([#32](https://github.com/haihv/valifetch/pull/32))

### Maintenance

- Pin `esbuild` to `^0.28.1` and bump `form-data` / `undici` to clear dev-dependency advisories; `npm audit` now reports 0 vulnerabilities. ([#37](https://github.com/haihv/valifetch/pull/37), [#38](https://github.com/haihv/valifetch/pull/38))
- Fix two `buildRequest` benchmarks that passed the global `URL` constructor instead of a URL string, so the suite runs cleanly. ([#39](https://github.com/haihv/valifetch/pull/39))
- CI: replace the deprecated Codecov test-results action and harden against transient Codecov upload errors. ([#36](https://github.com/haihv/valifetch/pull/36))

## [0.6.0] - 2026-05-11

### Added

- **`responseBody` on `HTTP_ERROR`** — `checkResponseStatus` is now async and clones the response to parse the server's error detail (JSON → text → `undefined`) before throwing. The result is available as `ValifetchError.responseBody` so callers no longer need to re-fetch or re-parse the error body. ([#31](https://github.com/haihv/valifetch/pull/31))
- **`debug` lifecycle option** — pass `debug: true` to emit structured `DebugEvent` objects via `console.debug`, or pass a function to receive each event directly. Four event types cover the full request lifecycle: `request` (per attempt), `response`, `retry` (with delay and reason), and `cancel` (user abort only). Inherited through `extend()`; child value overrides parent. ([#31](https://github.com/haihv/valifetch/pull/31))
- **`valifetch/mock` subpath** — `createMock()` testing utility that intercepts requests via the `beforeRequest` hook (no `globalThis.fetch` patching). Supports per-URL handlers, wildcard fallback, call history inspection, and `mockOnce` for one-shot responses. ([#32](https://github.com/haihv/valifetch/pull/32))
- **`responseType: 'sse'`** — built-in Server-Sent Events frame parsing. Returns an async iterable of typed `SseEvent` objects (`{ event, data, id, retry }`) from a `text/event-stream` response. ([#29](https://github.com/haihv/valifetch/pull/29))
- **`Retry-After` header support** — on 429 responses the client now reads the `Retry-After` header (seconds or HTTP-date) and waits at least that long before retrying, up to the configured `maxDelay`. ([#28](https://github.com/haihv/valifetch/pull/28))

### Documentation

- Add `llms.txt` and `AGENTS.md` for AI agent discoverability — machine-readable API reference covering all options, error codes, hook signatures, and auth helpers.

## [0.5.1] - 2026-05-02

### Added

- **Benchmark suite** — Vitest bench suite covering the core pipeline (request build, response parse, retry, hooks). Run with `npm run bench`. ([#27](https://github.com/haihv/valifetch/pull/27))

### Maintenance

- Upgrade all dependencies to latest ([#26](https://github.com/haihv/valifetch/pull/26))
- Update `@codecov/rollup-plugin` to v2; fix postcss XSS advisory ([#25](https://github.com/haihv/valifetch/pull/25))

## [0.5.0] - 2026-04-12

### Added

- **`valifetch/auth` subpath** — built-in `beforeRequest` hook factories for common auth patterns: `bearerAuth`, `basicAuth`, and `jwtRefresh`. Zero runtime cost if unused (tree-shaken out). The `jwtRefresh` helper queues concurrent requests during an in-flight refresh so only one refresh call is made. ([#23](https://github.com/haihv/valifetch/pull/23))
- **Cancellable requests** — every HTTP method now returns a `CancellablePromise<T>` with an attached `.cancel()` method. Calling `.cancel()` aborts the in-flight request and rejects with `ValifetchError { code: 'ABORT_ERROR' }`. User-provided `signal` and `.cancel()` work independently via `AbortSignal.any()`. ([#24](https://github.com/haihv/valifetch/pull/24))
- **`CancellablePromise<T>` type** — exported from `valifetch` and `valifetch/types` for use in typed applications.

### Maintenance

- Enable Codecov Test Analytics — JUnit XML reports uploaded to Codecov after each CI run for flaky test detection ([#21](https://github.com/haihv/valifetch/pull/21))
- Enable Codecov Bundle Analysis — bundle stats uploaded on each build via `@codecov/rollup-plugin` to track size regressions on PRs ([#22](https://github.com/haihv/valifetch/pull/22))

## [0.4.3] - 2026-04-02

### Documentation

- Reduce JSR exports to a single entry point (`.`) to eliminate duplicate symbol declarations across entry points — achieves 100% JSR documentation score
- Add documented `default` export to `src/core/valifetch.ts` so `import valifetch from 'valifetch'` is fully documented

### Note

The `valifetch/error` and `valifetch/types` subpath imports remain available on **npm**. On JSR, use the main entry (`@haihv/valifetch`) which exports all symbols.

## [0.4.2] - 2026-04-01

### Documentation

- Add JSDoc to all exported type members (`CallableInstance`, `Hooks`, `NormalizedOptions`, `BuildUrlOptions`, `ValidateOptions`, `HandleResponseOptions`, `ParamsOption`) to reach 100% JSR score

## [0.4.1] - 2026-04-01

### Documentation

- Add JSR module-level docs to all three entry points (`valifetch`, `valifetch/error`, `valifetch/types`) to reach 100% JSR score

## [0.4.0] - 2026-04-01

### Added

- **`onDownloadProgress` callback** — track download progress with `loaded`, `total`, and `percent` fields; works with chunked transfer encoding ([#14](https://github.com/haihv/valifetch/pull/14))
- **Form body support** — pass `form: FormData` for multipart uploads or `form: URLSearchParams` for `application/x-www-form-urlencoded` requests ([#11](https://github.com/haihv/valifetch/pull/11))
- **JSR registry** — package is now published to [JSR](https://jsr.io) in addition to npm ([#8](https://github.com/haihv/valifetch/pull/8))

### Fixed

- Aligned subpath exports — `AfterParseResponseHook` and `CallableInstance` are now correctly exported from `valifetch/types` ([#9](https://github.com/haihv/valifetch/pull/9))

### Maintenance

- Restricted `GITHUB_TOKEN` permissions in CI and publish workflows ([#12](https://github.com/haihv/valifetch/pull/12), [#13](https://github.com/haihv/valifetch/pull/13))
- Added integration test suite with a real HTTP server covering chunked progress, FormData upload, retry, timeout, and prefixUrl ([#15](https://github.com/haihv/valifetch/pull/15))

## [0.3.0] - 2026-03-30

### Added

- **Stream response type** — pass `responseType: 'stream'` to get a `ReadableStream<Uint8Array>` directly, bypassing JSON parsing and schema validation. Useful for SSE and large binary downloads. ([06882b7](https://github.com/haihv/valifetch/commit/06882b7))
- **Request deduplication** — pass `dedupe: true` to coalesce concurrent in-flight requests to the same URL into a single fetch. Cache is keyed on method + full URL and cleared once the request settles. ([89228b6](https://github.com/haihv/valifetch/commit/89228b6))

### Changed

- Replaced ESLint + Prettier with [Biome](https://biomejs.dev/) — single Rust-based tool covering linting, formatting, and import sorting (~100x faster, no TypeScript version constraints) ([499d690](https://github.com/haihv/valifetch/commit/499d690))
- Upgraded TypeScript to v6 ([9578130](https://github.com/haihv/valifetch/commit/9578130))
- Upgraded vitest to 4.1.2, eslint to 10.1.0 ([499d690](https://github.com/haihv/valifetch/commit/499d690))

### Fixed

- Resolved audit vulnerabilities in `brace-expansion`, `picomatch`, and `yaml` (transitive dependencies) ([499d690](https://github.com/haihv/valifetch/commit/499d690))

## [0.2.0] - 2026-03-25

### Added

- **Callable syntax** — wrap any instance with `.callable()` for ky-style direct invocation: `api('/users')` defaults to GET; pass `method` in options for other verbs ([fde7ba2](https://github.com/haihv/valifetch/commit/fde7ba2))

### Changed

- Improved test coverage for edge cases and defensive code paths ([e5facfd](https://github.com/haihv/valifetch/commit/e5facfd))
- Added Codecov integration for automated coverage reporting ([91159b7](https://github.com/haihv/valifetch/commit/91159b7))

## [0.1.1] - 2026-03-25

### Fixed

- Use merged options (including parent instance options) when building the fetch `RequestInit`, fixing a bug where extended instance headers and hooks were ignored ([dfa4633](https://github.com/haihv/valifetch/commit/dfa4633))
- Optimized instance creation and path parameter parsing for lower overhead ([8d4fe5d](https://github.com/haihv/valifetch/commit/8d4fe5d))

## [0.1.0] - 2026-03-25

### Added

- Initial release
- Type-safe HTTP client built on native `fetch` with [Valibot](https://valibot.dev) schema validation
- HTTP methods: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`
- Response types: `json`, `text`, `blob`, `arrayBuffer`, `formData`, `raw`, `stream`
- Path parameters with `:param` syntax and schema validation
- Request body, search params, and response schema validation
- Retry with exponential backoff and jitter
- Timeout via `AbortController`
- `beforeRequest`, `afterResponse`, `afterParseResponse` hooks
- Instance creation with `create()` and inheritance with `extend()`
- Dual CJS/ESM output with subpath exports (`valifetch/error`, `valifetch/types`)

[0.4.0]: https://github.com/haihv/valifetch/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/haihv/valifetch/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/haihv/valifetch/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/haihv/valifetch/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/haihv/valifetch/releases/tag/v0.1.0
