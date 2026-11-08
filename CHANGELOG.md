# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-11-08

### Fixed

- **`HTTP_ERROR` message without a status text.** Over HTTP/2 and HTTP/3, which have no reason phrase, the message ended with a stray `: ` (`Request failed with status 404: `). It now ends at the status code (`Request failed with status 404`); a non-empty `statusText` is still appended.

### Documentation

- **Shorter README.** The README is now a landing page: features linking to their docs pages, install, a quick start and links. The full reference lives on the [documentation site](https://haihv.github.io/valifetch/), and the versioning policy moved to its [Versioning page](https://haihv.github.io/valifetch/guide/versioning). The package still ships `llms.txt` and `AGENTS.md` as the offline reference for agents.

## [1.0.0] - 2026-11-07

First stable release. The public API is now covered by semantic versioning; see [Versioning & Stability](https://github.com/haihv/valifetch/blob/main/README.md#versioning--stability) in the README for what counts as a breaking change. Upgrading from 0.8.0: read the **Security** and **Changed** sections below; every item marked **Breaking** turns input that used to be accepted (sometimes unsafely) into a `TypeError` or a different outcome.

### Security

- **Prefix containment.** With `prefixUrl` set, the final URL always keeps the prefix origin and its path stays under the prefix path. Absolute or protocol-relative inputs (`https://evil.com`, `//evil.com`, `\\evil.com`) become path segments under the prefix, and a path that climbs above it with `..` (including `%2e%2e`, `.%2E`, `%2E.`) throws a `TypeError` before any request is sent. **Behaviour change.**
- **`prefixUrl` with a query string or fragment is rejected.** A `?` or `#` in `prefixUrl` swallowed the request path into the query (`/v1?k=1` + `/users` → `?k=1/users`); it now throws a `TypeError` whose message does not echo the URL. **Behaviour change.**
- **Dot-segment path params are rejected.** A `params` value of `.` or `..` throws a `TypeError`: `encodeURIComponent` leaves dots as-is and the URL parser resolves dot segments, so such a value silently walked up the path. **Behaviour change.**
- **Path params are read as own properties only.** `:constructor` or `:toString` without a matching param now throws as missing instead of sending a stringified `Object.prototype` function. **Behaviour change.**
- **Prototype-pollution-safe option merging.** `create()` / `extend()` assign user-supplied option and header keys as own data properties, so a JSON-derived `__proto__` key can no longer swap an object's prototype.
- **`debug: true` no longer logs secrets.** It now logs a plain summary (`type`, `method`, `url`, `headers`, plus `attempt`/`status`/`responseHeaders` or `attempt`/`delay`/`reason`) instead of the raw `Request`/`Response`, with sensitive header and URL query-parameter values replaced by `[REDACTED]` (names containing `auth`, `cookie`, `token`, `secret`, `key`, `session`, `pass`, `credential`, `sig`, `jwt`, `dpop`, `csrf`, `xsrf`, `otp`, `bearer` or `code`). A custom `debug` function still receives the live objects. **Behaviour change.**
- **Bounded `Retry-After`.** A server `Retry-After` longer than the new `retry.maxRetryAfter` (default 60 s) is not retried, so a server can no longer stall the client for an arbitrary time. Unlike ky, which clamps the wait to `maxRetryAfter` and still retries, valifetch skips the retry and surfaces the response. **Behaviour change.**
- **Strict `Retry-After` parsing.** Only all-digit seconds or an HTTP-date are honoured; values such as `1.5`, `1e9`, `0x10`, `-1` or `5abc` (previously read by `parseInt`) are ignored in favour of the normal backoff. **Behaviour change.**
- **Retry sleeps are clamped** to 0..2^31 − 1 ms, so a huge delay no longer overflows `setTimeout` into an immediate retry, and a `NaN` delay becomes 0.
- **Bounded SSE buffering.** The SSE parser caps the pending (unterminated) event at `sseMaxEventSize` (default 16 MiB), checked after each chunk, and throws `PARSE_ERROR` past it (an event terminated within the same chunk is delivered whatever its size), so a server that never sends a blank line cannot exhaust memory. Each chunk is now scanned in linear time. **Behaviour change.**
- **`SECURITY.md`** documents supported versions, private vulnerability reporting and the threat model (what valifetch guarantees and what stays your responsibility).

### Added

- **`RetryOptions.maxRetryAfter`** — the longest server-sent `Retry-After`, in milliseconds, the client is willing to wait (default `60_000`; `Infinity` waits for any value; an invalid value falls back to the default). A longer delay is handled as if retries were exhausted. The check runs after `shouldRetry` and before `beforeRetry`, so no `beforeRetry` hook or `retry` debug event fires for it.
- **`sseMaxEventSize` option** — largest pending (unterminated) SSE event buffered, in UTF-16 code units (default 16 MiB, 16,777,216; `Infinity` disables the cap). Allowed on `create()` / `extend()` and per call; the per-call value wins.
- **JSR `auth` and `mock` entry points** — `jsr:@haihv/valifetch/auth` and `jsr:@haihv/valifetch/mock` are now published alongside the main entry, keeping the 100% documentation score. `./error` and `./types` stay npm-only because they only re-export symbols already in `.`, `./auth` or `./mock`.
- **Documentation site** — a VitePress site with guides, recipes (auth, SSE, mocking, pagination, parallel requests, file upload), migration guides from ky and axios, and an API reference generated from JSDoc with TypeDoc, deployed to GitHub Pages by CI.
- **Search and agent discoverability** — the docs site serves `llms.txt` (a page index plus the API summary), `llms-full.txt` and a Markdown version of every page (append `.md` to its URL), with per-page descriptions, canonical and Open Graph tags, a sitemap and JSON-LD. The npm package now ships `llms.txt` and `AGENTS.md`, and its `homepage` points at the docs site.
- **Browser test suite** — Vitest browser-mode smoke tests against the native `fetch` of Chromium, Firefox and WebKit via Playwright (`npm run test:browser`), run in CI.
- **Semver policy** — the README "Versioning & Stability" section (condensed in `llms.txt` and `AGENTS.md`) defines the public API and what is major, minor and patch, including which documented defaults are covered.

### Changed

- **Breaking:** a request path that resolves outside `prefixUrl` (`/../admin`, `/%2e%2e/admin`) throws a `TypeError`. Previously the URL parser silently resolved it above the prefix path.
- **Breaking:** a `prefixUrl` containing `?` or `#` throws a `TypeError`. Put default query values in `searchParams`.
- **Breaking:** a path param whose value is `.` or `..` throws a `TypeError`.
- **Breaking:** path params are looked up as own properties only; a param resolved from `Object.prototype` now throws as missing.
- **Breaking:** a retryable response whose `Retry-After` exceeds `retry.maxRetryAfter` (default 60 s) is no longer retried; it throws `HTTP_ERROR` (or is returned with `throwHttpErrors: false`). Previously any `Retry-After` was waited for. Pass `maxRetryAfter: Infinity` for the old behaviour.
- **Breaking:** `Retry-After` parsing is strict; malformed values that `parseInt` used to accept are ignored and the normal backoff applies.
- **Breaking:** a pending (unterminated) SSE event larger than 16 MiB now throws `PARSE_ERROR`; set `sseMaxEventSize: Infinity` to restore unbounded buffering.
- **Breaking:** `debug: true` output changed from the raw `DebugEvent` (live `Request`/`Response`) to a plain, redacted summary object. Custom `debug` functions are unchanged.
- **Breaking:** a `ReadableStream` request `body` throws a `TypeError` before calling `fetch` on runtimes that cannot stream request bodies (Firefox, older Safari), instead of sending a corrupted body or failing inside `fetch`. Node 22+, Deno and Chromium-based browsers (over HTTP/2 or newer) still stream them.
- A per-request or child-instance `retry` object replaces the instance `retry` object entirely; this was already the behaviour and is now documented (restate `maxRetryAfter` when you override `retry`).

### Fixed

- SSE: a `\r\n` pair split across two chunks no longer produces a spurious blank line, which could split one event into two.
- SSE: a line ending in `\r` is processed as soon as its chunk arrives, so a CR-only server's events are no longer held back until the next chunk.
- SSE: leaving the `for await` loop early (`break`, `return` or a throw) now cancels the response body and releases the connection instead of leaving it open.
- The JSR main, `auth` and `mock` entries now pass `deno check`: URL search-param merging and the mock call recorder no longer iterate `URLSearchParams` / `Headers`, which Deno's bundled lib types without an iterator.
- `valifetch/mock`: a `__proto__` request header is recorded as a plain own key instead of invoking the prototype setter.
- `valifetch/mock`: runs of `*` in a URL pattern are collapsed before compiling, avoiding polynomial backtracking on a non-matching path.
- Firefox: a `ReadableStream` request body was silently sent as the string `[object ReadableStream]`; it now throws a `TypeError` (see **Changed**).
- Docs: README corrections — `delete()` and `options()` reject `json`/`form`/`body` like `get()`, the hook-signature note now says ky 1.x, and mocked responses are not retried by the `retry` option.

### Maintenance

- Bump dev dependencies to latest (Biome 2.6.6, Vitest and `@vitest/coverage-v8` 5.1, `@types/node` 26.6.6, axios 1.21, `@emnapi/*`) and override `zod` to `^4.6.7`; `npm audit` reports 0 vulnerabilities.
- Benchmarks migrated to the Vitest 5 `bench.compare` API; README and `llms.txt` benchmark tables re-measured.
- TypeScript stays on 6.0.3: tsup 9 builds declarations through the TypeScript compiler API, which TypeScript 7 no longer ships.
- The `zod` 4 override also applies to the Codecov bundler plugin, which is written against zod 3: its custom option-validation messages (`invalid_type_error`) fall back to zod's default wording. Harmless here because the plugin options are static.
- New `deno` CI job: `deno check` on the three JSR entry points, a Deno runtime smoke test (`tests/deno/smoke.ts`, also `npm run test:deno`) and `npx jsr publish --dry-run`.
- CI now runs `npm run typecheck` (previously only the pre-commit hook did).
- CI hardening: job `timeout-minutes`, `persist-credentials: false` on every checkout, and a build-only docs workflow run on pull requests.

## [0.8.0] - 2026-08-21

### Added

- **Raw request bodies** — new request-only `body` option accepting a `string`, `Blob`, `ArrayBuffer`, typed array, or `ReadableStream<Uint8Array>`, sent exactly as given with no validation and no `Content-Type` inference (set it yourself). `ReadableStream` bodies automatically get `duplex: 'half'`. Not accepted at instance level nor on the bodyless methods (`get`/`head`/`delete`/`options` type surface). New exported `RawBody` type. ([#49](https://github.com/haihv/valifetch/pull/49))
- **`RetryOptions.shouldRetry` predicate** — `shouldRetry(ctx)` receives `{ request, retryCount, reason, response | error }` and returns `true` (retry even if status/method would not), `false` (never), or `undefined` (defer to the built-in check); may be async; always bounded by `limit`; runs before `beforeRetry`. New `RetryContext` type (also the base of `BeforeRetryState`). ([#48](https://github.com/haihv/valifetch/pull/48))
- **`beforeRetry` / `beforeError` hooks** — `beforeRetry` runs before each retry is scheduled and can return the exported `stop` sentinel to abort retrying or a new `Request` to replace the request for remaining attempts; `beforeError` runs just before any `ValifetchError` is thrown and can mutate or replace it. New types `BeforeRetryHook`, `BeforeRetryState`, `BeforeErrorHook`. ([#45](https://github.com/haihv/valifetch/pull/45))

### Changed

- **Breaking: setting more than one body option now throws.** `json`, `form`, and `body` are mutually exclusive; a request with two or more of them throws a `TypeError` (a plain `TypeError`, not a `ValifetchError`). Previously `json` silently won over `form`. ([#49](https://github.com/haihv/valifetch/pull/49))
- **Minimum supported Node.js is now 22** (`engines.node: ">=22.0.0"`); Node 20 reached end-of-life and is dropped from the CI matrix, which now runs on Node 22, 24 and 26. ([#46](https://github.com/haihv/valifetch/pull/46))
- **Breaking: `extend()` now inherits/applies every instance option.** Previously the object form of `extend()` silently dropped child `dedupe`, `onDownloadProgress`, `searchParams`, and `priority`. ([#47](https://github.com/haihv/valifetch/pull/47))
- **Instance-level `searchParams` is now applied.** Instance values are defaults; per-request `searchParams` merge on top, with the request winning per key. `extend()` merges parent and child `searchParams` the same way.
- **Instance-level `onDownloadProgress` now works** (previously ignored when set via `create()`/`extend()`).
- **Breaking: `form` is now request-only.** Removed from instance (`create()`/`extend()`) options, and no longer accepted on `get()`/`head()`. `json`/`form` remain available on `post`/`put`/`patch`/`delete`/`options` (the types already rejected them on `delete`/`options`; corrected in 1.0.0 docs).
- **Breaking: `signal` (and `window`) removed from instance options** — request-only now. `priority` (`'high' | 'low' | 'auto'`) is now forwarded to `fetch` from both instance and per-request options.
- **Breaking: deduplication key changed.** `dedupe: true` now keys on the fully-resolved URL (`prefixUrl` + path params + merged `searchParams`) plus method, scoped per instance (also for `create()` with no arguments — each such instance gets its own dedupe cache) — different search params or different instances no longer collide. `.cancel()` on a deduped promise aborts the shared request for every caller. ([#47](https://github.com/haihv/valifetch/pull/47))
- **Breaking: `NormalizedOptions` (what hooks receive) now reflects what's actually present** — `method`, `headers: Headers`, `signal` (the composed signal: caller signal + `.cancel()` controller, not the caller's raw signal), and required `hooks`/`validateRequest`/`validateResponse`/`throwHttpErrors`, plus optional `responseType`, `responseSchema`, `bodySchema`, `paramsSchema`, `searchSchema`, `json`, `params`.
- Callable instance: `api(url, { method, responseType, ... })` now typechecks (previously rejected by the type). `callable().head()` no longer accepts `responseType`/`responseSchema`, matching `ValifetchInstance.head()`.
- `afterResponse` hooks now also run on a `Response` returned by a `beforeRequest` hook, so `valifetch/mock` responses flow through `afterResponse` like any other response.
- **Breaking: `PARSE_ERROR` now covers `text`/`blob`/`arrayBuffer`/`formData` reads too**, not only JSON. `PARSE_ERROR` carries the raw `cause`, and for JSON reads, `responseBody` = the unparseable text. `ValifetchError.responseBody` is populated on `HTTP_ERROR` (parsed JSON, or text) and `PARSE_ERROR` (raw text).
- **New `ValifetchError.target` getter** (`= validation?.target`, i.e. `'response' | 'body' | 'params' | 'search'`). Request-side `VALIDATION_ERROR` (target `body`/`params`/`search`) now has `error.request === undefined`, since the `Request` doesn't exist yet at that point in the pipeline.
- **Breaking: `MockCall.method` is now `HttpMethod`** (was a plain string).
- `JwtRefreshOptions.onRefreshed` is now optional and may return a `Promise`, which is awaited.

### Fixed

- Requests with a body (e.g. `PUT` + `json`) are now retried correctly — previously the second attempt failed with a spurious `NETWORK_ERROR` because the already-sent request could not be cloned. ([#45](https://github.com/haihv/valifetch/pull/45))
- `dedupe: true` no longer produces an unhandled promise rejection when the shared request fails. ([#45](https://github.com/haihv/valifetch/pull/45))
- Timeout detection is now by identity — a user-supplied `abort(new Error('Request timed out'))` now correctly surfaces as `ABORT_ERROR`, not `TIMEOUT_ERROR`. ([#47](https://github.com/haihv/valifetch/pull/47))
- A request with a `timeout` whose caller `signal` was already aborted no longer hangs forever — the abort is propagated immediately as `ABORT_ERROR`. ([#47](https://github.com/haihv/valifetch/pull/47))
- Header merge in `extend()` is now case-insensitive, with the child instance's value winning on a case-insensitive key collision.
- `create()` called with no arguments no longer shares a deduplication cache between instances — each no-arg `create()` now gets its own dedupe cache, matching the per-instance scoping documented for `dedupe`.
- Explicit `undefined`/`null` in a per-request `searchParams` key now removes the corresponding instance default instead of leaving it in the merged query string.

### Maintenance

- Bump dev dependencies (Biome 2.5, Vitest 4.1.11, `@types/node` 26, lint-staged 17, axios 1.19) and clear the `nanoid` advisory GHSA-2v37-7h3g-55p8; `npm audit` reports 0 vulnerabilities. Biome config migrated to the 2.5 schema. ([#46](https://github.com/haihv/valifetch/pull/46))
- `npm run typecheck` now also typechecks `tests/`. ([#47](https://github.com/haihv/valifetch/pull/47))
- Removed the unused internal `ParamsOption` type — it was never reachable from any entry point.

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

[1.0.1]: https://github.com/haihv/valifetch/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/haihv/valifetch/compare/v0.8.0...v1.0.0
[0.8.0]: https://github.com/haihv/valifetch/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/haihv/valifetch/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/haihv/valifetch/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/haihv/valifetch/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/haihv/valifetch/compare/v0.4.3...v0.5.0
[0.4.3]: https://github.com/haihv/valifetch/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/haihv/valifetch/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/haihv/valifetch/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/haihv/valifetch/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/haihv/valifetch/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/haihv/valifetch/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/haihv/valifetch/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/haihv/valifetch/releases/tag/v0.1.0
