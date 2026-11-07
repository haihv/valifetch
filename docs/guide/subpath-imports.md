# Subpath imports and tree-shaking

valifetch is fully tree-shakeable. For minimal bundle size, import just what you need.

```ts
// Main import: the core runtime
import valifetch, { ValifetchError } from 'valifetch';

// Just the error class
import { ValifetchError } from 'valifetch/error';

// Just the auth helpers (zero runtime cost if unused)
import { bearerAuth, basicAuth, jwtRefresh } from 'valifetch/auth';

// Testing utilities (import in test files only)
import { createMock } from 'valifetch/mock';

// Just types (no runtime code)
import type {
  ValifetchOptions,
  RawBody,
  RetryOptions,
  RetryContext,
  BeforeRequestHook,
  BeforeRetryHook,
  BeforeRetryState,
  BeforeErrorHook,
  AfterResponseHook,
  AfterParseResponseHook,
  CallableInstance,
} from 'valifetch/types';
```

The package uses code splitting internally, so code shared between entry points is only loaded once. The package has `"sideEffects": false`.

## Entry points

| Entry | Kind | Contents |
|---|---|---|
| `valifetch` | runtime | Core client, `ValifetchError`, `stop`, and the core types |
| `valifetch/error` | runtime | `ValifetchError` and its option types |
| `valifetch/types` | types only | Every public type |
| `valifetch/auth` | runtime | `bearerAuth`, `basicAuth`, `jwtRefresh`, `JwtRefreshOptions` |
| `valifetch/mock` | runtime | `createMock()` and the mock types |

**Entry-point rule:** `valifetch` (`.`) exports the core runtime plus the core types you need day to day. `valifetch/types` is the superset: every public type, including the less common ones like `JwtRefreshOptions`, `MockCall`, `MockHandler` and `ValifetchMock`. `./error`, `./auth` and `./mock` are runtime subpaths.

::: info JSR
On JSR, `.`, `./auth` and `./mock` are published:

```ts
import valifetch, { ValifetchError } from 'jsr:@haihv/valifetch';
import { bearerAuth } from 'jsr:@haihv/valifetch/auth';
import { createMock } from 'jsr:@haihv/valifetch/mock';
```

`./error` and `./types` are npm-only, because they only re-export symbols already exported from `.`, and re-exporting the same symbol from several JSR entry points duplicates it and lowers the documentation score. On JSR, import `ValifetchError` and the types from `jsr:@haihv/valifetch`.
:::

## Module resolution

Subpath imports need TypeScript `moduleResolution` set to `"node16"`, `"nodenext"` or `"bundler"`.

## Dual format

Every entry ships as both ESM and CommonJS, with matching type declarations.
