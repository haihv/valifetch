# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run test                          # run all tests once (unit + integration)
npm run test:watch                    # run all tests in watch mode (development)
npm run test -- <file>                # run a single test file
npm run test:unit                     # run unit tests only (tests/unit/)
npm run test:integration              # run integration tests only (tests/integration/)
npm run test:browser                  # browser smoke tests in Chromium, Firefox and WebKit (tests/browser/)
npm run test:browser:install          # one-time: download Playwright browsers (+ OS deps on Linux)
npm run test:deno                     # Deno: type-check entry points + runtime smoke (tests/deno/smoke.ts); needs deno + npm ci
npm run test:coverage                 # run all tests with coverage (100% threshold enforced)
npm run build                         # build to dist/ via tsup
npm run check                         # Biome check (lint + format + imports)
npm run check:fix                     # Biome check with auto-fix
npm run typecheck                     # tsc --noEmit
npm run bench                         # run all benchmarks (bench/ directory)
npm run docs:api                      # generate the API reference (docs/api/) from JSDoc via TypeDoc
npm run docs:dev                      # generate the API reference, then serve the docs site locally
npm run docs:build                    # generate the API reference, then build the site to docs/.vitepress/dist (fails on dead links)
npm run docs:preview                  # serve the built docs site
```

## Architecture

Valifetch is a type-safe HTTP client built on native `fetch` with Valibot schema validation. It uses a **prototype-based instance model** — instances share a prototype with HTTP methods and only carry one to three small own properties (`opts`, plus `parent` and a lazily cached `merged` for an `extend()` child), keeping memory footprint minimal.

### Core pipeline

```
valifetch.get(url, opts)
  → buildRequest()        src/core/request.ts     — URL construction, path params, body/schema validation
  → executeRequest()      src/core/valifetch.ts    — beforeRequest hooks (once), then fetch + retry loop, timeout; beforeRetry hooks run inside retry loop
  → afterResponse hooks   src/core/hooks.ts        — run on every response (even 4xx/5xx) before the status check; may replace the Response
  → checkResponseStatus() src/core/response.ts     — async; throws ValifetchError on 4xx/5xx with parsed responseBody
  → parseJsonResponse()   src/core/response.ts     — JSON parse + optional Valibot schema validation
  → afterParseResponse hooks
  → beforeError hooks (catches & transforms ValifetchError before throwing to caller)
```

### Key modules

| File                           | Responsibility                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/core/valifetch.ts`        | Instance creation (`create`, `extend`, `callable`), HTTP method dispatch, options merging, dedupe (keyed on the fully-resolved URL + method, scoped per instance) |
| `src/core/request.ts`          | Builds `Request` object; validates request body/params/search against schemas; handles `json`, `form` and raw `body` bodies |
| `src/core/response.ts`         | Status checking (async, attaches `responseBody`), JSON parsing, schema validation, SSE frame parsing (bounded by `sseMaxEventSize`, cancels the body on early exit) |
| `src/core/retry.ts`            | Exponential backoff with jitter; default 2 retries on `[408, 413, 429, 500–504]`; `resolveRetryDecision` consults the optional `retry.shouldRetry` predicate before falling back to the built-in status/method check; `getRetryAfterDelay` parses `Retry-After` strictly and returns it unclamped — the retry loop in `valifetch.ts` skips the retry when it exceeds `maxRetryAfter` (validated in `normalizeRetryOptions`) |
| `src/core/hooks.ts`            | `beforeRequest`, `afterResponse`, `afterParseResponse`, `beforeRetry`, `beforeError` hook runners; re-exports `stop` |
| `src/core/stop.ts`             | The `stop` sentinel (`Symbol.for('valifetch.stop')`) — a leaf module with no imports, so `src/types/hooks.ts` can reference it without a module cycle |
| `src/errors/ValifetchError.ts` | Custom error class with typed error codes; `responseBody` field on `HTTP_ERROR`           |
| `src/url/`                     | URL building and `:param` → value path replacement; enforces prefix containment (origin + path) and rejects `.`/`..` param values |
| `src/validation/validate.ts`   | Thin wrapper around `valibot.safeParse`                                                   |
| `src/types/`                   | All TypeScript types (options, hooks, instance, path-param inference) — no runtime code   |
| `src/mock/`                    | `createMock()` — testing utility; intercepts via `beforeRequest` hook, no `globalThis.fetch` patching |
| `src/auth.ts`                  | `bearerAuth`, `basicAuth`, `jwtRefresh` — `beforeRequest` hook factories for common auth patterns |

### Instance inheritance

`extend()` creates a child instance that inherits parent options. An instance's own properties are `opts`, plus `parent` for an `extend()` child; merged options (headers, hooks, etc.) are lazily computed on first access and cached in a `merged` own property. Hooks from parent and child are **concatenated** (parent runs first).

### Docs site

`docs/` is a VitePress site deployed to GitHub Pages by `.github/workflows/docs.yml` (`base: '/valifetch/'`); pull requests touching the docs inputs only build it (the deploy job is skipped). Hand-written pages live in `docs/guide/`, `docs/recipes/` and `docs/migration/`; `docs/api/` is **generated** (gitignored) by `scripts/generate-api-docs.mjs`, which runs TypeDoc (`typedoc.json`, plugins `typedoc-plugin-markdown` + `typedoc-vitepress-theme`) over the five entry points in `src/` and feeds `docs/api/typedoc-sidebar.json` into `docs/.vitepress/config.ts`. Agent and SEO output: `vitepress-plugin-llms` generates `/llms.txt` (a page index followed by the repo-root `llms.txt` reference, via `customLLMsTxtTemplate`), `/llms-full.txt` and a Markdown twin of every page (`foo/index.md` becomes `foo.md`); the `buildEnd` hook (`absolutizeAgentLinks`) rewrites their site-relative links to absolute `.md` URLs. `transformHead` adds per-page canonical, Open Graph/Twitter tags, `rel="alternate" type="text/markdown"` and `rel="describedby"` (llms.txt) links, and JSON-LD on the home page; `sitemap.hostname` emits `sitemap.xml`. Every hand-written page needs a quoted `description` in its frontmatter (it becomes the meta description and the llms.txt entry). The plugin's minimatch is overridden onto the patched 11.x like TypeDoc's. `scripts/typedoc-minimatch-compat.mjs` is a preload that lets TypeDoc 0.28 run against the patched minimatch pinned in `package.json` `overrides`; `vitepress` is likewise overridden onto a patched `vite` 7 (the direct `vite` devDependency keeps vitest on vite 8). Keep option names in docs pages verified against `src/types/`; the build must stay free of dead links.

### Live demo

`examples/demo/` is a standalone Vite app (its own `package.json` and lockfile, not part of the root build, tests or typecheck) linked from the README badge and opened by StackBlitz straight from GitHub (`stackblitz.com/github/haihv/valifetch/tree/main/examples/demo`). It installs the **published** `valifetch` from npm, so it shows what users get; after a release with a breaking change, update `src/main.ts` and bump its `valifetch` range. `src/main.ts` holds the examples and is the file StackBlitz opens; `src/ui.ts` only wires them to buttons. Verify with `npm install && npm run typecheck && npm run build` inside the folder.

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
- Cross-origin redirect — `Authorization` / `Cookie` are dropped by native fetch when a redirect changes origin (`security.integration.test.ts`)
- `Retry-After` over `maxRetryAfter` — 429 with `Retry-After: 120` and `maxRetryAfter: 50` is not retried (`security.integration.test.ts`)
- SSE CR-only latency and early `break` — a `\r\r`-terminated event is yielded before the next chunk; `break` closes the server connection (`security.integration.test.ts`)

Security regression tests live in `tests/unit/security.test.ts`; the threat model they back is documented in `SECURITY.md`. Option-merging code must assign user-supplied keys as own data properties (`setOwn` in `src/core/valifetch.ts`), never via `target[key] = value`, so a JSON-derived `__proto__` key cannot swap a prototype.

Browser smoke tests live in `tests/browser/*.browser.test.ts` and run under Vitest browser mode with the Playwright provider (`@vitest/browser-playwright`), configured in `vitest.browser.config.ts` with one headless instance per engine. They are excluded from the default `vitest.config.ts` (so `npm run test` and the 100% coverage gate never see them) and run in the separate `browser` CI job. `tests/browser/global-setup.ts` starts a CORS-enabled `node:http` server (reusing `tests/integration/helpers.ts`) and passes its origin to the specs via `provide`/`inject('serverOrigin')`; the page and server are different origins, so every request is a real cross-origin fetch with preflight. Specs branch on `server.browser` (from `vitest/browser`) where engines genuinely differ — never skip silently, document the engine limitation in the test. Run `npm run test:browser:install` once locally to fetch the browsers. Playwright 1.65's Firefox does not launch on macOS 27 hosts ("Could not find profile folder"): locally run `npm run test:browser -- --project chromium --project webkit`, or use the `mcr.microsoft.com/playwright` Docker image for Firefox; CI runs all three.

The Deno runtime smoke test lives in `tests/deno/smoke.ts`: a plain Deno script (not Vitest) that starts a `Deno.serve` server and runs a validated JSON GET plus a `ReadableStream` POST through valifetch, failing on any mismatch. It uses Deno globals and `.ts` import specifiers, so it is excluded from `tsconfig.test.json` and is not matched by the Vitest `include`. Run it with `npm run test:deno` (which also runs `deno check` on the three JSR entry points); Deno resolves `valibot` from the local `node_modules`, so run `npm ci` first. The `deno` CI job runs the same checks plus `npx jsr publish --dry-run --allow-dirty`.

Integration tests are not run in the pre-commit hook (too slow); they run in CI alongside unit tests.

`npm run typecheck` also typechecks `tests/` (not just `src/`), so type errors in test files fail the same gate as production code.

### API design decisions (locked for 1.0)

These choices are intentional — do not "fix" the asymmetries without a deliberate breaking-change decision. User-facing rationale lives in `docs/guide/api-design-decisions.md`.

- **`searchParams` (+ `searchSchema`) vs `params` (+ `paramsSchema`).** `searchParams` mirrors `URL.searchParams` and ky; the stem mismatch with `searchSchema` is accepted in favour of platform alignment.
- **`json` / `form` / `body`.** Structured bodies go through `json` (validated against `bodySchema`) or `form`; `body` is the raw escape hatch (string, `Blob`, `ArrayBuffer`, typed array, `ReadableStream`) sent as-is with no validation or `Content-Type` inference. Exactly one may be set per request — two or more throws a `TypeError`; none is accepted at instance level.
- **`responseType` is per-call only.** It changes the call's return type, which cannot be typed at instance-creation time, so it is deliberately absent from `ValifetchBaseOptions` / `ValifetchInstanceOptions`.
- **`ValifetchError.cause` is `unknown`.** Matches the standard `Error.cause`; accepts any thrown value without wrapping.
- **Hook signatures stay positional, following ky 1.x** (ky 2 moved to state objects). `beforeRequest(request, options)`, `afterResponse(request, options, response)`, `afterParseResponse(data, response, request)`, `beforeRetry(state)`, `beforeError(error)` — not unified into a single state-object signature. A throwing hook propagates that error as-is (no `HOOK_ERROR` wrapping); `beforeError` only ever sees `ValifetchError`s.
- **Entry-point rule.** `valifetch` (`.`) exports the core runtime + core types; `valifetch/types` exports every public type (including `JwtRefreshOptions`, `MockCall`, `MockHandler`, `ValifetchMock`); `./error`, `./auth`, `./mock` are runtime subpaths. JSR publishes `.`, `./auth` and `./mock`; `./error` and `./types` stay npm-only because they only re-export symbols already in `.`, `./auth` or `./mock`.
- **Counter semantics.** `RetryOptions.delay(attempt)` is 0-based (`delay(0)` = first retry); `BeforeRetryState.retryCount` and a `DebugEvent` retry `attempt` are both 1-based ("the retry about to be performed").

## Rules

- **Benchmarks must stay in sync with code.** Any change to a public function signature (including sync → async) must be reflected in the corresponding `bench/` file in the same commit. After any change touching `src/core/` or `src/errors/`, run `npm run bench` and verify it exits cleanly (no unhandled rejections, no errors). The benchmark numbers in `docs/guide/performance.md` and `llms.txt`, and the ratios in the README's Performance summary, must be updated whenever the comparison bench results shift materially.
- **Docs must stay in sync with code.** Any change to public API, options, behaviour, or architecture must be reflected in the docs site pages that cover it (`docs/guide/`, `docs/recipes/`, `docs/migration/`; the API reference regenerates from JSDoc), in `README.md` when it changes the feature list, install steps or quick start, and in this file if architecture changes. The README is a short landing page (pitch, features linking to the docs, install, quick start, links): keep reference material on the docs site, not in the README. Do not merge code changes without updating the relevant docs.
- **`llms.txt` and `AGENTS.md` must stay in sync with code.** Any change to public API, options, error codes, hook signatures, auth helpers, or behaviour must also be reflected in both `llms.txt` and `AGENTS.md`. These are agent-facing docs — stale information causes agents to generate broken code. Update them in the same commit as the code change.
- **Every exported symbol must have JSDoc.** This includes top-level exports and all members of exported types/classes (fields, methods, getters). Plain `//` comments do not count; use `/** */` blocks.
- **JSR documentation score must stay at 100%.** Before opening or merging a PR, verify every new exported symbol has a JSDoc block. `jsr.json` exports `.`, `./auth` and `./mock`. This is safe only because those entry points have disjoint exported symbol sets and each starts with a `@module` JSDoc block (verified with `deno doc --json`: no symbol appears in more than one of them, 0 undocumented declarations; `npx jsr publish --dry-run --allow-dirty` succeeds). Do not add `./error` or `./types` to `jsr.json` — they only re-export symbols already exported from `.`, `./auth` or `./mock` (38 duplicated symbols), which drops the score below 100%. Before adding any new JSR entry point, re-run that duplicate check and keep its symbols disjoint from the others.
- **Never embed issue tracker IDs in source code.** No Linear, Jira, or GitHub issue numbers in test descriptions, function names, comments, or any other code. Issue IDs belong in commit messages and PR descriptions only.
- **Never merge a PR without explicit confirmation.** Do not call `gh pr merge` (or any equivalent) without the user explicitly saying to merge. Opening a PR is fine; merging is not.
- **Never push to `main` without explicit confirmation.** Do not `git push` the main branch (or push a version-bump commit) without the user saying so. Always stop and confirm first.
