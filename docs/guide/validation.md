# Validation

valifetch validates four things with [Valibot](https://valibot.dev) schemas:

| Option | Validates | `ValidationTarget` |
|---|---|---|
| `responseSchema` | The parsed response body | `'response'` |
| `bodySchema` | The `json` request body | `'body'` |
| `paramsSchema` | Path parameters (`params`) | `'params'` |
| `searchSchema` | Search parameters (`searchParams`) | `'search'` |

A failed schema rejects with a `ValifetchError` whose `code` is `VALIDATION_ERROR`.

## Response validation

```ts
const user = await valifetch.get('https://api.example.com/users/1', {
  responseSchema: UserSchema,
});
```

The return type is `InferOutput<typeof UserSchema>`. Valibot transformations in the schema apply, so a schema that parses ISO strings into `Date` objects yields `Date` objects in the result.

## Request validation

```ts
const newUser = await valifetch.post('https://api.example.com/users', {
  json: { name: 'John', email: 'john@example.com' },
  bodySchema: CreateUserSchema,
  responseSchema: UserSchema,
});
```

When `bodySchema` is set, `json` is typed as the schema's **input** type.

::: tip
`bodySchema` applies to `json` only. A raw `body` or a `form` body is never validated against it.
:::

## Path parameter inference

The `:name` segments of a string-literal URL are extracted at the type level. With no `paramsSchema`, `params` must contain exactly those keys with `string | number` values:

```ts
await valifetch.get('/users/:id/posts/:postId', {
  params: { id: 1, postId: 2 }, // both keys are required
});
```

With a `paramsSchema`, `params` is typed from the schema's input instead, and the schema runs before the URL is built:

```ts
await valifetch.get('https://api.example.com/users/:id', {
  params: { id: 123 },
  paramsSchema: v.object({
    id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  responseSchema: UserSchema,
});
```

The helper types `ExtractPathParams`, `PathParamsRecord` and `HasPathParams` are exported from `valifetch` and `valifetch/types`.

## Search parameter validation

```ts
const users = await valifetch.get('https://api.example.com/users', {
  searchParams: { page: 1, limit: 10, q: 'john' },
  searchSchema: v.object({
    page: v.optional(v.pipe(v.number(), v.integer())),
    limit: v.optional(v.pipe(v.number(), v.integer(), v.maxValue(100))),
    q: v.optional(v.string()),
  }),
  responseSchema: v.array(UserSchema),
});
```

## Reading validation failures

```ts
import { ValifetchError } from 'valifetch';

try {
  await api.get('/users/1', { responseSchema: UserSchema });
} catch (error) {
  if (error instanceof ValifetchError && error.isValidationError) {
    console.log(error.target); // 'response' | 'body' | 'params' | 'search'
    console.log(error.issues); // Valibot issues
    console.log(error.validation?.input); // the value that failed
  }
}
```

`error.validation` is `{ target, issues, input }`. `error.request` and `error.response` are only set when `target === 'response'`. For `body`, `params` and `search` the `Request` does not exist yet, so `error.request` is `undefined`.

## Turning validation off

`validateResponse: false` skips `responseSchema`; `validateRequest: false` skips `bodySchema`, `paramsSchema` and `searchSchema`. Both default to `true` and can be set per request or on an instance. See [Requests](/guide/requests#disabling-validation).

## Without a schema

You can still get a result type without runtime validation by passing a generic:

```ts
type User = { id: number; name: string };
const user = await valifetch.get<User>('/users/1');
```

This is a type assertion only. Prefer a schema for data you do not control.
