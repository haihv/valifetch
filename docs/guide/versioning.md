---
description: "valifetch follows semantic versioning from 1.0.0: what counts as a breaking change, which defaults are covered, and how deprecations work."
---

# Versioning and stability

From 1.0.0, valifetch follows [Semantic Versioning](https://semver.org). The public API is everything documented on this site (the guides, recipes and API reference) and in the repository README, in the JSDoc of the exports of `valifetch`, `valifetch/error`, `valifetch/types`, `valifetch/auth` and `valifetch/mock`, and in `llms.txt` / `AGENTS.md`. Anything else is internal.

## Major (breaking) changes

- Removing or renaming any export of the five subpaths (`.`, `./error`, `./types`, `./auth`, `./mock`), or removing a subpath.
- Changing a hook signature (the positional arguments of `beforeRequest`, `afterResponse`, `afterParseResponse`, `beforeRetry`, `beforeError`) or hook ordering semantics (parent hooks run before child hooks; hooks run in array order).
- Renaming an option, or changing an option's type so that previously valid input is rejected at compile time or at runtime.
- Changing a documented default: retry limit `2`, retry statuses `[408, 413, 429, 500–504]`, retry-eligible methods, `retry.maxRetryAfter` `60000` ms, `sseMaxEventSize` 16 MiB (16,777,216 UTF-16 code units), `throwHttpErrors: true`, no timeout unless `timeout` is set, and so on.
- Removing or renaming a `ValifetchError` code, or changing which code a given failure produces (for example a failure that surfaced as `NETWORK_ERROR` now surfacing as `ABORT_ERROR`).
- Changing the return type of an HTTP method, or the shape of a `ValifetchError` field.
- Raising the minimum Node.js major (currently `>=22`). Dropping a Node.js version is a breaking change even when that version is end-of-life, so it only ships in a major release. This keeps `engines` a promise users can rely on within a major line.
- Narrowing the `valibot` peer range (currently `>=1.0.0`), for example by dropping support for a valibot major.

## Minor (non-breaking) changes

- New options, new exports, new hook types, new methods and new subpaths.
- Widening accepted input (an option that accepts more types than before).
- Adding a new `ValifetchError` code. A new code is observable by an exhaustive `switch` over `ErrorCode`, so code-based handling should keep a `default` branch. The addition is accepted in a minor release and announced in the changelog. A new code is never used for a failure that already produces an existing code; that would be a breaking change (see above).
- Making types stricter so that they catch real runtime errors (for example a type that previously accepted an input that always threw at runtime). Stricter types that reject input which worked at runtime are major.
- Raising the minimum supported TypeScript version. valifetch supports TypeScript versions released within the last two years; the floor moves only in a minor release and is announced in the changelog.

## Patch changes

- Bug fixes, performance improvements and documentation updates.
- Fixing behaviour that contradicted the documentation is a patch, even if some users depended on the buggy behaviour. The documentation (this site, the README, JSDoc and `llms.txt`) is the specification.

## Internal and undocumented

Anything undocumented (for example the `opts`, `parent` and `merged` properties an instance carries), or whose name starts with `_`, is internal and not covered by semver. The same applies to the `dist/` file layout, chunk names, and the exact wording of error messages (match on `error.code`, not `error.message`).

## Deprecation process

A feature is deprecated with a `@deprecated` JSDoc tag (naming the replacement) and a CHANGELOG note, in a minor release. It is removed no earlier than the next major release, and at least one minor release after the deprecation.

## See also

- Release notes for every version are in the [changelog](https://github.com/haihv/valifetch/blob/main/CHANGELOG.md).
- The deliberate API shape decisions that are locked for stability are summarised in [API design decisions](/guide/api-design-decisions).
