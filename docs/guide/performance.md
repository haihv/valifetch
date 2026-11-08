---
description: "valifetch benchmark results against ky, ofetch and axios on Node.js 24, and the cost of schema validation."
---

# Performance

Benchmarked with Vitest's [benchmark API](https://vitest.dev/guide/benchmarking) on Node.js 24, with `fetch` mocked to eliminate network variance. Run `npm run bench` in the repository to reproduce on your machine.

::: tip Why is ofetch faster on the baseline?
ofetch is a minimal wrapper with no built-in retry, hook system or schema validation. valifetch bundles all of that, so the gap reflects features, not inefficiency. Schema validation itself adds roughly 10-15% overhead over valifetch's own baseline.
:::

## GET + JSON parse (no schema)

| Library | ops/sec | vs valifetch |
|---|---|---|
| ofetch | 192,529 | 1.86× faster |
| **valifetch** | **103,649** | baseline |
| up-fetch | 54,582 | 1.90× slower |
| ky | 49,388 | 2.10× slower |
| axios (fetch adapter) | 26,933 | 3.85× slower |

## GET + JSON parse + schema validation

Only valifetch and up-fetch support schema validation natively. ky, ofetch and axios would require a manual parse step on top of their baseline cost.

| Library | ops/sec | vs valifetch |
|---|---|---|
| **valifetch + valibot** | **90,743** | baseline |
| up-fetch + valibot | 46,978 | 1.93× slower |

## POST with JSON body

| Library | ops/sec | vs valifetch |
|---|---|---|
| ofetch | 139,527 | 1.89× faster |
| **valifetch** | **73,777** | baseline |
| up-fetch | 41,702 | 1.77× slower |
| ky | 22,881 | 3.22× slower |
| axios (fetch adapter) | 22,318 | 3.31× slower |

## 4xx error path

| Library | ops/sec | vs valifetch |
|---|---|---|
| ofetch | 55,654 | 1.55× faster |
| up-fetch | 49,698 | 1.39× faster |
| **valifetch** | **35,792** | baseline |
| ky | 27,038 | 1.32× slower |
| axios (fetch adapter) | 11,666 | 3.07× slower |

axios constructs a full `AxiosError` with a deep copy of the request config on every error, which explains the roughly 3× gap.

Coming from another client? See the migration guides for [ky](/migration/from-ky) and [axios](/migration/from-axios).
