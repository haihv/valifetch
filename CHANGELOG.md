# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
