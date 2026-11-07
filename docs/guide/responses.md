# Responses

`responseType` controls how the response body is read and what the call resolves to. It is set per request (see [API design decisions](/guide/api-design-decisions)).

| `responseType` | Resolves to |
|---|---|
| `'json'` (default) | Parsed JSON, validated against `responseSchema` when given |
| `'text'` | `string` |
| `'blob'` | `Blob` |
| `'arrayBuffer'` | `ArrayBuffer` |
| `'formData'` | `FormData` |
| `'stream'` | `ReadableStream` (`response.body`) |
| `'raw'` | The raw `Response` object |
| `'sse'` | `AsyncIterable<MessageEvent>` |

```ts
// JSON (default)
const data = await valifetch.get('https://api.example.com/data');

// Text
const html = await valifetch.get('https://example.com', {
  responseType: 'text',
});

// Blob
const image = await valifetch.get('https://example.com/image.png', {
  responseType: 'blob',
});

// Streaming: returns response.body as a ReadableStream
const stream = await valifetch.get('https://example.com/large-file', {
  responseType: 'stream',
});

// Raw Response object
const response = await valifetch.get('https://example.com', {
  responseType: 'raw',
});
```

Parsing failures for `json`, `text`, `blob`, `arrayBuffer` and `formData` reject with a `PARSE_ERROR`.

## Server-sent events

With `responseType: 'sse'` the call resolves to an async iterable of `MessageEvent`s. valifetch parses the SSE frame protocol internally.

```ts
const events = await valifetch.get('https://api.example.com/stream', {
  responseType: 'sse',
});

for await (const event of events) {
  console.log(event.type, event.data); // event.type defaults to 'message'
}
```

Per the frame protocol, `event:` sets the event type, `data:` lines are joined into `event.data`, `id:` sets `lastEventId`, lines starting with `:` are comments and are ignored, and `retry:` is parsed but not yielded. It is a reconnect hint that does not apply to a one-shot fetch.

See [SSE and AI streaming](/recipes/sse-streaming) for a complete example.

## Download progress

`onDownloadProgress` is fired for each received chunk with a `DownloadProgressEvent`:

```ts
type DownloadProgressEvent = {
  loaded: number; // bytes received so far
  total: number | undefined; // total bytes (undefined without a Content-Length header)
  percent: number | undefined; // 0-100 (undefined if total is unknown)
};
```

```ts
const data = await valifetch.get('https://api.example.com/large-file.json', {
  onDownloadProgress: ({ loaded, total, percent }) => {
    if (percent !== undefined) {
      console.log(`Downloaded ${percent.toFixed(1)}% (${loaded}/${total} bytes)`);
    } else {
      console.log(`Downloaded ${loaded} bytes`);
    }
  },
});
```

::: warning
`onDownloadProgress` is not called when `responseType` is `'stream'`, `'raw'` or `'sse'`, because in those modes the caller takes direct ownership of the response body.
:::

An instance-level `onDownloadProgress` (set on `create()` or inherited via `extend()`) works the same as the per-request option.

There is no upload progress callback; see [File upload](/recipes/file-upload) for why.

## After parsing

The [`afterParseResponse` hook](/guide/hooks#afterparseresponse) can transform the parsed value. It does not run for `'stream'`, `'raw'` or `'sse'`, and therefore never for `head()`.
