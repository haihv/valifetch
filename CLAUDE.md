# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run test                          # run all tests once (unit + integration)
npm run test:watch                    # run all tests in watch mode (development)
npm run test -- <file>                # run a single test file
npm run test:unit                     # run unit tests only (tests/unit/)
npm run test:integration              # run integration tests only (tests/integration/)
npm run test:coverage                 # run all tests with coverage (100% threshold enforced)
npm run test:integration:coverage     # integration tests with coverage, no threshold (diagnostic: shows which src/ lines they exercise independently)
npm run build                         # build to dist/ via tsup
npm run check                         # Biome check (lint + format + imports)
npm run check:fix                     # Biome check with auto-fix
npm run typecheck                     # tsc --noEmit
```

## Architecture

Valifetch is a type-safe HTTP client built on native `fetch` with Valibot schema validation. It uses a **prototype-based instance model** — instances share a prototype with HTTP methods and only carry 1–2 own properties, keeping memory footprint minimal.

### Core pipeline

```
valifetch.get(url, opts)
  → buildRequest()        src/core/request.ts     — URL construction, path params, body/schema validation
  → executeRequest()      src/core/valifetch.ts    — fetch + retry loop, timeout, beforeRequest hooks
  → checkResponseStatus() src/core/response.ts     — throws ValifetchError on 4xx/5xx
  → parseJsonResponse()   src/core/response.ts     — JSON parse + optional Valibot schema validation
  → afterResponse/afterParseResponse hooks
```

### Key modules

| File                           | Responsibility                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/core/valifetch.ts`        | Instance creation (`create`, `extend`, `callable`), HTTP method dispatch, options merging |
| `src/core/request.ts`          | Builds `Request` object; validates request body/params/search against schemas; handles `json` and `form` bodies |
| `src/core/response.ts`         | Status checking, JSON parsing, response schema validation                                 |
| `src/core/retry.ts`            | Exponential backoff with jitter; default 2 retries on `[408, 413, 429, 500–504]`          |
| `src/core/hooks.ts`            | `beforeRequest`, `afterResponse`, `afterParseResponse` hook runners                       |
| `src/errors/ValifetchError.ts` | Custom error class with typed error codes                                                 |
| `src/url/`                     | URL building and `:param` → value path replacement                                        |
| `src/validation/validate.ts`   | Thin wrapper around `valibot.safeParse`                                                   |
| `src/types/`                   | All TypeScript types (options, hooks, instance, path-param inference) — no runtime code   |

### Instance inheritance

`extend()` creates a child instance that inherits parent options. Merged options (headers, hooks, etc.) are lazily computed on first access and cached as `_mergedOptions`. Hooks from parent and child are **concatenated** (parent runs first).

### Package exports

Three subpath exports: `.` (main), `./error` (error class), `./types` (types only, zero runtime). All dual CJS/ESM via tsup. `valibot` is a peer dependency — not bundled.

### Testing

Unit tests live in `tests/unit/` and mock `globalThis.fetch` via `vi.spyOn`. They enforce 100% branch/line/function coverage on `src/`.

Integration tests live in `tests/integration/` and spin up a real `http.createServer` (Node built-in, zero extra deps). They are excluded from the 100% coverage threshold but still run in `npm run test`. Key scenarios covered:

- Chunked `onDownloadProgress` — real chunked transfer with `Content-Length`, verifies `loaded`/`total`/`percent`
- FormData multipart upload — verifies `multipart/form-data` boundary and field names reach the server
- Retry on 503 → 200 — real HTTP 503 triggers a retry; second request returns 200
- Timeout — server never responds; asserts `TIMEOUT_ERROR` within the configured `timeout` ms
- `prefixUrl` path joining — trailing-slash normalization and search-param encoding round-trips

Integration tests are not run in the pre-commit hook (too slow); they run in CI alongside unit tests.

## Rules

- **Docs must stay in sync with code.** Any change to public API, options, behaviour, or architecture must be reflected in `README.md` (and this file if architecture changes). Do not merge code changes without updating the relevant docs.
