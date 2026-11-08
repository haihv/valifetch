---
description: "Turn on valifetch debug mode for structured request lifecycle logging, with sensitive headers and query parameters redacted automatically."
---

# Debug mode

Enable structured lifecycle logging for development by passing `debug: true` (emits via `console.debug`) or a custom function.

```ts
// Emit all events to console.debug
const api = valifetch.create({ debug: true });

// Custom handler with full type safety on the event
import type { DebugEvent } from 'valifetch/types';

const api2 = valifetch.create({
  debug: (event: DebugEvent) => {
    if (event.type === 'request') {
      console.log('->', event.request.method, event.request.url);
    } else if (event.type === 'response') {
      console.log('<-', event.response.status, `(attempt ${event.attempt})`);
    } else if (event.type === 'retry') {
      console.log(
        `retry attempt ${event.attempt}, delay ${event.delay}ms, reason: ${event.reason}`
      );
    } else if (event.type === 'cancel') {
      console.log('cancelled:', event.request.url);
    }
  },
});
```

## What `debug: true` logs

`debug: true` logs a plain, redacted summary per event, not the raw `Request` and `Response` objects:

```ts
console.debug('[valifetch]', {
  type: 'response',
  method: 'GET',
  url: 'https://api.example.com/users?access_token=[REDACTED]',
  headers: { authorization: '[REDACTED]', accept: 'application/json' },
  attempt: 1, // response and retry events
  status: 200, // response events
  responseHeaders: { 'content-type': 'application/json' }, // response events
  // retry events carry `attempt`, `delay` and `reason` instead
});
```

The value of a header, or of a URL query parameter, is replaced with `'[REDACTED]'` when its name contains (case-insensitive) `auth`, `cookie`, `token`, `secret`, `key`, `session`, `pass`, `credential`, `sig`, `jwt`, `dpop`, `csrf`, `xsrf`, `otp`, `bearer` or `code`. That covers `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `?access_token=`, presigned-URL `X-Amz-Signature` and OAuth `?code=`. The match is deliberately broad, so some harmless names are redacted too. Only the logged summary is redacted; the request itself is unchanged. The URL path is logged as-is, so keep secrets out of paths.

::: warning Custom functions see everything
A custom `debug` function receives the live `Request` and `Response` with headers unredacted. Redacting secrets before you log them is up to you.
:::

## Event types

`DebugEvent` is a discriminated union. The `type` field narrows the payload.

| `type` | Extra fields |
|---|---|
| `'request'` | `request: Request` |
| `'response'` | `request`, `response: Response`, `attempt: number` |
| `'retry'` | `request`, `attempt`, `delay: number`, `reason: 'status' \| 'network'` |
| `'cancel'` | `request` |

`debug` is inherited by child instances created with `extend()`. A child can override it by passing its own `debug` value. The `attempt` on a retry event is 1-based; see [Retry](/guide/retry#counter-semantics).
