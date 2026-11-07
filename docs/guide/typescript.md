# TypeScript

valifetch infers types from your Valibot schemas.

```ts
import * as v from 'valibot';
import valifetch from 'valifetch';

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
});

// Response type is inferred as { id: number; name: string }
const user = await valifetch.get('/users/1', {
  responseSchema: UserSchema,
});

// Or use a generic type without a schema (no runtime validation)
type User = { id: number; name: string };
const user2 = await valifetch.get<User>('/users/1');

// Path params are type-checked
await valifetch.get('/users/:id/posts/:postId', {
  params: { id: 1, postId: 2 }, // TypeScript knows these are required
});
```

## What gets inferred

- **Response:** with `responseSchema`, the result is `InferOutput` of the schema; otherwise the generic `TData` (default `unknown`).
- **Request body:** with `bodySchema`, `json` is typed as the schema's `InferInput`.
- **Path params:** extracted from the URL string literal. With `paramsSchema`, typed from the schema's input.
- **Return type by `responseType`:** `'blob'` gives `Blob`, `'text'` gives `string`, `'sse'` gives `AsyncIterable<MessageEvent>`, and so on. This also holds for callable calls like `api(url, { method: 'GET', responseType: 'blob' })`.

## Importing types

All public types are available from the zero-runtime `valifetch/types` entry point:

```ts
import type {
  ValifetchOptions,
  ValifetchInstance,
  RetryOptions,
  BeforeRequestHook,
  DebugEvent,
} from 'valifetch/types';
```

The root entry exports the core types you need day to day; `valifetch/types` is the superset, including `JwtRefreshOptions`, `MockCall`, `MockHandler` and `ValifetchMock`. See [Subpath imports](/guide/subpath-imports).

## Reference

The [API reference](/api/) lists every exported type with its documentation.
