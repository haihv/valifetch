# Debug mode

Enable structured lifecycle logging for development by passing `debug: true` (emits via `console.debug`) or a custom function.

::: danger Do not enable in production
`debug: true` logs raw `Request` and `Response` objects, including headers such as `Authorization` and cookies.
:::

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

## Event types

`DebugEvent` is a discriminated union. The `type` field narrows the payload.

| `type` | Extra fields |
|---|---|
| `'request'` | `request: Request` |
| `'response'` | `request`, `response: Response`, `attempt: number` |
| `'retry'` | `request`, `attempt`, `delay: number`, `reason: 'status' \| 'network'` |
| `'cancel'` | `request` |

`debug` is inherited by child instances created with `extend()`. A child can override it by passing its own `debug` value. The `attempt` on a retry event is 1-based; see [Retry](/guide/retry#counter-semantics).
