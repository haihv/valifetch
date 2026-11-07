# Pagination

Two common shapes: a cursor in the response body, and a `Link` header. Both are plain loops, and both keep every page validated.

## Cursor pagination

Describe one page with a schema, then loop until the server stops returning a cursor. An async generator lets callers stop early.

```ts
import valifetch from 'valifetch';
import * as v from 'valibot';

const api = valifetch.create({ prefixUrl: 'https://api.example.com' });

const ItemSchema = v.object({ id: v.number(), name: v.string() });

const PageSchema = v.object({
  items: v.array(ItemSchema),
  nextCursor: v.nullable(v.string()),
});

type Item = v.InferOutput<typeof ItemSchema>;

async function* listItems(pageSize = 50): AsyncGenerator<Item> {
  let cursor: string | null = null;

  do {
    const page = await api.get('/items', {
      searchParams: { limit: pageSize, cursor },
      responseSchema: PageSchema,
    });

    yield* page.items;
    cursor = page.nextCursor;
  } while (cursor !== null);
}

for await (const item of listItems()) {
  console.log(item.name);
}
```

`searchParams` entries set to `null` or `undefined` are omitted, so the first request goes out without a `cursor`.

To collect everything:

```ts
const all: Item[] = [];
for await (const item of listItems()) all.push(item);
```

## Link-header pagination

APIs such as GitHub's put the next URL in a `Link` header. Use `responseType: 'raw'` to get the `Response`, read the header, then validate the body yourself:

```ts
import valifetch from 'valifetch';
import * as v from 'valibot';

const RepoSchema = v.object({ id: v.number(), full_name: v.string() });
const ReposSchema = v.array(RepoSchema);

type Repo = v.InferOutput<typeof RepoSchema>;

function nextUrl(response: Response): string | undefined {
  const link = response.headers.get('link');
  const match = link?.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1];
}

async function* listRepos(org: string): AsyncGenerator<Repo> {
  let url: string | undefined = `https://api.github.com/orgs/${org}/repos?per_page=100`;

  while (url) {
    const response = await valifetch.get(url, { responseType: 'raw' });
    yield* v.parse(ReposSchema, await response.json());
    url = nextUrl(response);
  }
}
```

The `next` URL is absolute and already carries its query string, so pass it straight to `valifetch.get` without a `prefixUrl`. If you use an instance with a `prefixUrl`, strip the origin and the prefix path first: valifetch joins the input under the prefix, so a full URL would become a path segment, and a path that leaves the prefix path throws a `TypeError`.

::: warning Trust the next URL only from the API you called
A `Link` header is server-controlled. If your requests carry credentials, check that the next URL stays on the expected origin before following it.
:::

## Tips

- Combine pagination with [`retry`](/guide/retry): a transient 503 on page 7 is retried without restarting the loop.
- Pass the same `signal` to every page request so a single `AbortController` stops the whole iteration.
- Use a `searchSchema` when the pagination parameters themselves come from user input.
