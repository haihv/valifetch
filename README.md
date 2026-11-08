# Valifetch

[![npm version](https://img.shields.io/npm/v/valifetch.svg)](https://www.npmjs.com/package/valifetch)
[![JSR](https://jsr.io/badges/@haihv/valifetch)](https://jsr.io/@haihv/valifetch)
[![npm downloads](https://img.shields.io/npm/dm/valifetch.svg)](https://www.npmjs.com/package/valifetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/haihv/valifetch/actions/workflows/ci.yml/badge.svg)](https://github.com/haihv/valifetch/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/haihv/valifetch/graph/badge.svg)](https://codecov.io/gh/haihv/valifetch)
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/haihv/valifetch/tree/main/examples/demo?file=src%2Fmain.ts)

A type-safe HTTP client built on native `fetch` with [Valibot](https://valibot.dev) schema validation. Like [ky](https://github.com/sindresorhus/ky), but with built-in request/response validation.

**Documentation: <https://haihv.github.io/valifetch/>**

**Try it live:** [open the demo in StackBlitz](https://stackblitz.com/github/haihv/valifetch/tree/main/examples/demo?file=src%2Fmain.ts). It runs in your browser and shows response validation, request-body validation and typed errors against a real API. The source is in [`examples/demo`](examples/demo).

For AI agents: [`llms.txt`](https://haihv.github.io/valifetch/llms.txt) indexes the docs, [`llms-full.txt`](https://haihv.github.io/valifetch/llms-full.txt) bundles them in one file, and every page is available as Markdown by appending `.md` to its URL. The npm package also ships `llms.txt` and `AGENTS.md`.

## Features

- **Schema validation** of responses, JSON bodies, path params and search params with Valibot, with full type inference. [Validation](https://haihv.github.io/valifetch/guide/validation)
- **Native `fetch`**, no HTTP library dependency, ~17 KB, tree-shakeable, with `valibot` as a peer dependency. [Subpath imports](https://haihv.github.io/valifetch/guide/subpath-imports)
- **Auto-parsed responses**: JSON, text, blob, Server-Sent Events and more, with download progress. [Responses](https://haihv.github.io/valifetch/guide/responses)
- **Retries** with exponential backoff, jitter and `Retry-After` support. [Retry](https://haihv.github.io/valifetch/guide/retry)
- **Timeouts and cancellation**: every call returns a promise with `.cancel()`. [Requests](https://haihv.github.io/valifetch/guide/requests)
- **Hooks**: `beforeRequest`, `afterResponse`, `afterParseResponse`, `beforeRetry` and `beforeError`. [Hooks](https://haihv.github.io/valifetch/guide/hooks)
- **Typed errors**: one `ValifetchError` with a `code` to switch on, and the server's error body attached. [Errors](https://haihv.github.io/valifetch/guide/errors)
- **Instances** with `create()` and `extend()`, plus an optional ky-style callable syntax. [Instances](https://haihv.github.io/valifetch/guide/instances)
- **Auth helpers** (`bearerAuth`, `basicAuth`, `jwtRefresh`) and a **test mock** that needs no `fetch` patching. [Auth](https://haihv.github.io/valifetch/recipes/auth) · [Testing](https://haihv.github.io/valifetch/recipes/testing)
- **Hardened by default**: prefix containment, path-param encoding, redacted debug logs and bounded SSE buffering. [Security](https://haihv.github.io/valifetch/guide/security)

## Installation

**npm / Node.js**

```bash
npm install valifetch valibot
```

**Deno (via JSR)**

```ts
import valifetch from 'jsr:@haihv/valifetch';
```

Or add to `deno.json`:

```bash
deno add jsr:@haihv/valifetch
```

**Bun / other runtimes (via JSR)**

```bash
bunx jsr add @haihv/valifetch
```

The JSR package also publishes the `auth` and `mock` subpaths:

```ts
import { bearerAuth } from 'jsr:@haihv/valifetch/auth';
import { createMock } from 'jsr:@haihv/valifetch/mock';
```

`valifetch/error` and `valifetch/types` are npm-only because they are re-exports of symbols already available from the main entry (`import { ValifetchError } from 'jsr:@haihv/valifetch'`).

## Quick start

```typescript
import valifetch, { ValifetchError } from 'valifetch';
import * as v from 'valibot';

const User = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

const api = valifetch.create({
  prefixUrl: 'https://api.example.com',
  timeout: 10_000,
});

try {
  // Parsed and validated, no .json() needed.
  // `user` is typed { id: number; name: string; email: string }.
  const user = await api.get('/users/:id', {
    params: { id: 1 },
    responseSchema: User,
  });
} catch (error) {
  if (error instanceof ValifetchError) {
    // 'VALIDATION_ERROR' | 'HTTP_ERROR' | 'TIMEOUT_ERROR' | ...
    console.error(error.code, error.status, error.issues);
  }
}
```

## Documentation

The full documentation is at **<https://haihv.github.io/valifetch/>**:

- **Guide**: [getting started](https://haihv.github.io/valifetch/guide/getting-started), [requests](https://haihv.github.io/valifetch/guide/requests), [responses](https://haihv.github.io/valifetch/guide/responses), [validation](https://haihv.github.io/valifetch/guide/validation), [errors](https://haihv.github.io/valifetch/guide/errors), [instances](https://haihv.github.io/valifetch/guide/instances), [hooks](https://haihv.github.io/valifetch/guide/hooks), [retry](https://haihv.github.io/valifetch/guide/retry), [TypeScript](https://haihv.github.io/valifetch/guide/typescript)
- **Recipes**: [auth](https://haihv.github.io/valifetch/recipes/auth), [SSE streaming](https://haihv.github.io/valifetch/recipes/sse-streaming), [testing](https://haihv.github.io/valifetch/recipes/testing), [pagination](https://haihv.github.io/valifetch/recipes/pagination), [parallel requests](https://haihv.github.io/valifetch/recipes/parallel-requests), [file upload](https://haihv.github.io/valifetch/recipes/file-upload)
- **Migrating**: [from ky](https://haihv.github.io/valifetch/migration/from-ky), [from axios](https://haihv.github.io/valifetch/migration/from-axios)
- **API reference**: [every export, generated from the JSDoc](https://haihv.github.io/valifetch/api/)

## Performance

On Node.js 24 with `fetch` mocked, valifetch does a GET plus JSON parse about 2.1× faster than ky and 3.9× faster than axios, and adds schema validation for roughly 10–15% overhead. ofetch is faster because it has no retry, hooks or validation. See the [benchmarks](https://haihv.github.io/valifetch/guide/performance), or run `npm run bench`.

## Versioning & Stability

From 1.0.0, valifetch follows [Semantic Versioning](https://semver.org). The [versioning policy](https://haihv.github.io/valifetch/guide/versioning) lists what counts as a breaking change, which documented defaults are covered, and how deprecations work. Match errors on `error.code`, not `error.message`: message wording is not covered.

## Requirements

- Node.js >= 22, or any runtime with native `fetch` (Deno, Bun, modern browsers)
- valibot >= 1.0.0
- TypeScript `moduleResolution` of `"node16"`, `"nodenext"` or `"bundler"` to resolve the subpath imports (`valifetch/auth`, `valifetch/mock`, ...)

## Security

See [SECURITY.md](https://github.com/haihv/valifetch/blob/main/SECURITY.md) for supported versions, how to report a vulnerability privately, and the threat model: what valifetch guarantees (prefix containment, path-param encoding, header-injection rejection, redacted `debug: true` logs, bounded SSE buffering and `Retry-After`) and what stays your responsibility (validating user-controlled full URLs, SSRF policy, response size limits).

## Contributing

Issues and PRs welcome!

Tests run with `npm test` (unit + integration). A separate browser smoke suite exercises valifetch against the native `fetch` of Chromium, Firefox and WebKit via Playwright: run `npm run test:browser:install` once to download the browsers, then `npm run test:browser`. With Deno installed, `npm run test:deno` type-checks the JSR entry points and runs a Deno runtime smoke test (`tests/deno/smoke.ts`).

## License

[MIT](LICENSE)

---

Built with [Claude Code](https://claude.com/claude-code).
