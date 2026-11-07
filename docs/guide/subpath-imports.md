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
On JSR only the main entry (`.`) is published. `valifetch/auth` and `valifetch/mock` are npm-only for now, to keep the single-entry-point 100% documentation score.
:::

## Module resolution

Subpath imports need TypeScript `moduleResolution` set to `"node16"`, `"nodenext"` or `"bundler"`.

## Dual format

Every entry ships as both ESM and CommonJS, with matching type declarations.
