# Parallel requests

Every instance has `all()` and `allSettled()`. They are sugar over `Promise.all` and `Promise.allSettled` with two additions: element types are preserved as a tuple, and the result is cancellable.

## all

`all()` runs requests in parallel and resolves to a tuple of their results. It rejects as soon as any request rejects.

```ts
const [user, posts] = await api.all([
  api.get('/users/1', { responseSchema: UserSchema }),
  api.get('/posts', { responseSchema: PostsSchema }),
]);
// user: User, posts: Post[]
```

::: warning
A rejection does **not** cancel the remaining in-flight requests. If you need that, call `.cancel()` on the batch or use an `AbortController`.
:::

## allSettled

`allSettled()` waits for every request to settle and never rejects. Each result is a standard `PromiseSettledResult`: `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }`, where `reason` is typically a `ValifetchError`.

```ts
import { ValifetchError } from 'valifetch';

const results = await api.allSettled([api.get('/a'), api.get('/b')]);

for (const result of results) {
  if (result.status === 'fulfilled') {
    console.log(result.value);
  } else if (result.reason instanceof ValifetchError) {
    console.error(result.reason.code, result.reason.status);
  }
}
```

## Cancelling a batch

Both return a `CancellablePromise`. Calling `.cancel()` aborts every input that exposes a `.cancel()` method (other valifetch requests) and silently ignores plain promises.

```ts
const batch = api.all([api.get('/a'), api.get('/b')]);
batch.cancel(); // aborts both in-flight requests
```

## Sharing one signal

For a fail-fast batch that stops the siblings on the first error, share an `AbortController`:

```ts
const controller = new AbortController();

try {
  const [a, b] = await api.all([
    api.get('/a', { signal: controller.signal }),
    api.get('/b', { signal: controller.signal }),
  ]);
} catch (error) {
  controller.abort(); // stop whatever is still running
  throw error;
}
```

## Limiting concurrency

`all()` starts everything at once. For long lists, process them in chunks:

```ts
async function inChunks<T, R>(
  items: T[],
  size: number,
  run: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    results.push(...(await Promise.all(chunk.map(run))));
  }
  return results;
}

const users = await inChunks(ids, 10, (id) =>
  api.get('/users/:id', { params: { id }, responseSchema: UserSchema })
);
```
