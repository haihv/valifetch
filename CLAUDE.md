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
npm run build                         # build to dist/ via tsup
npm run check                         # Biome check (lint + format + imports)
npm run check:fix                     # Biome check with auto-fix
npm run typecheck                     # tsc --noEmit
npm run bench                         # run all benchmarks (bench/ directory)
```

## Architecture

Valifetch is a type-safe HTTP client built on native `fetch` with Valibot schema validation. It uses a **prototype-based instance model** — instances share a prototype with HTTP methods and only carry 1–2 own properties, keeping memory footprint minimal.

### Core pipeline

```
valifetch.get(url, opts)
  → buildRequest()        src/core/request.ts     — URL construction, path params, body/schema validation
  → executeRequest()      src/core/valifetch.ts    — fetch + retry loop, timeout, beforeRequest hooks; beforeRetry hooks run inside retry loop
  → checkResponseStatus() src/core/response.ts     — async; throws ValifetchError on 4xx/5xx with parsed responseBody
  → parseJsonResponse()   src/core/response.ts     — JSON parse + optional Valibot schema validation
  → afterResponse/afterParseResponse hooks
  → beforeError hooks (catches & transforms ValifetchError before throwing to caller)
```

### Key modules

| File                           | Responsibility                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/core/valifetch.ts`        | Instance creation (`create`, `extend`, `callable`), HTTP method dispatch, options merging |
| `src/core/request.ts`          | Builds `Request` object; validates request body/params/search against schemas; handles `json` and `form` bodies |
| `src/core/response.ts`         | Status checking (async, attaches `responseBody`), JSON parsing, schema validation, SSE frame parsing |
| `src/core/retry.ts`            | Exponential backoff with jitter; default 2 retries on `[408, 413, 429, 500–504]`          |
| `src/core/hooks.ts`            | `beforeRequest`, `afterResponse`, `afterParseResponse`, `beforeRetry`, `beforeError` hook runners; re-exports `stop` |
| `src/core/stop.ts`             | The `stop` sentinel (`Symbol.for('valifetch.stop')`) — a leaf module with no imports, so `src/types/hooks.ts` can reference it without a module cycle |
| `src/errors/ValifetchError.ts` | Custom error class with typed error codes; `responseBody` field on `HTTP_ERROR`           |
| `src/url/`                     | URL building and `:param` → value path replacement                                        |
| `src/validation/validate.ts`   | Thin wrapper around `valibot.safeParse`                                                   |
| `src/types/`                   | All TypeScript types (options, hooks, instance, path-param inference) — no runtime code   |
| `src/mock/`                    | `createMock()` — testing utility; intercepts via `beforeRequest` hook, no `globalThis.fetch` patching |
| `src/auth.ts`                  | `bearerAuth`, `basicAuth`, `jwtRefresh` — `beforeRequest` hook factories for common auth patterns |

### Instance inheritance

`extend()` creates a child instance that inherits parent options. Merged options (headers, hooks, etc.) are lazily computed on first access and cached as `_mergedOptions`. Hooks from parent and child are **concatenated** (parent runs first).

### Package exports

Five subpath exports: `.` (main), `./error` (error class), `./types` (types only, zero runtime), `./auth` (auth hooks), `./mock` (testing utilities). All dual CJS/ESM via tsup. `valibot` is a peer dependency — not bundled.

### Testing

Unit tests live in `tests/unit/` and mock `globalThis.fetch` via `vi.spyOn`. They enforce 100% branch/line/function coverage on `src/`.

Integration tests live in `tests/integration/` and spin up a real `http.createServer` (Node built-in, zero extra deps). They are excluded from the 100% coverage threshold but still run in `npm run test`. Key scenarios covered:

- Chunked `onDownloadProgress` — real chunked transfer with `Content-Length`, verifies `loaded`/`total`/`percent`
- FormData multipart upload — verifies `multipart/form-data` boundary and field names reach the server
- Retry on 503 → 200 — real HTTP 503 triggers a retry; second request returns 200
- Timeout — server never responds; asserts `TIMEOUT_ERROR` within the configured `timeout` ms
- `afterResponse` 401-refresh — hook re-fetches with refreshed token and replacement response flows through the full pipeline
- `prefixUrl` path joining — trailing-slash normalization and search-param encoding round-trips
- `responseType: 'sse'` — real chunked `text/event-stream` response; verifies event type, data, and lastEventId
- `Retry-After` header — server returns 429 with `Retry-After: 1`; client waits ≥ 900 ms before retry

Integration tests are not run in the pre-commit hook (too slow); they run in CI alongside unit tests.

### API design decisions (locked for 1.0)

These choices are intentional — do not "fix" the asymmetries without a deliberate breaking-change decision. User-facing rationale lives in `README.md` ("API Design Decisions").

- **`searchParams` (+ `searchSchema`) vs `params` (+ `paramsSchema`).** `searchParams` mirrors `URL.searchParams` and ky; the stem mismatch with `searchSchema` is accepted in favour of platform alignment.
- **`json` / `form`, no generic `body`.** Native `body` is stripped via `Omit<RequestInit, 'body'>`; all bodies go through the typed/validated `json` or `form` path.
- **`responseType` is per-call only.** It changes the call's return type, which cannot be typed at instance-creation time, so it is deliberately absent from `ValifetchBaseOptions` / `ValifetchInstanceOptions`.
- **`ValifetchError.cause` is `unknown`.** Matches the standard `Error.cause`; accepts any thrown value without wrapping.

## Rules

- **Benchmarks must stay in sync with code.** Any change to a public function signature (including sync → async) must be reflected in the corresponding `bench/` file in the same commit. After any change touching `src/core/` or `src/errors/`, run `npm run bench` and verify it exits cleanly (no unhandled rejections, no errors). The benchmark numbers in `README.md` and `llms.txt` must be updated whenever the comparison bench results shift materially.
- **Docs must stay in sync with code.** Any change to public API, options, behaviour, or architecture must be reflected in `README.md` (and this file if architecture changes). Do not merge code changes without updating the relevant docs.
- **`llms.txt` and `AGENTS.md` must stay in sync with code.** Any change to public API, options, error codes, hook signatures, auth helpers, or behaviour must also be reflected in both `llms.txt` and `AGENTS.md`. These are agent-facing docs — stale information causes agents to generate broken code. Update them in the same commit as the code change.
- **Every exported symbol must have JSDoc.** This includes top-level exports and all members of exported types/classes (fields, methods, getters). Plain `//` comments do not count; use `/** */` blocks.
- **JSR documentation score must stay at 100%.** Before opening or merging a PR, verify every new exported symbol has a JSDoc block. This package uses a single entry point in `jsr.json` — do not add additional entry points, as multiple entry points cause symbol duplication that drops the score below 100%.
- **Never embed issue tracker IDs in source code.** No Linear, Jira, or GitHub issue numbers in test descriptions, function names, comments, or any other code. Issue IDs belong in commit messages and PR descriptions only.
- **Never merge a PR without explicit confirmation.** Do not call `gh pr merge` (or any equivalent) without the user explicitly saying to merge. Opening a PR is fine; merging is not.
- **Never push to `main` without explicit confirmation.** Do not `git push` the main branch (or push a version-bump commit) without the user saying so. Always stop and confirm first.
