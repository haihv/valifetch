---
description: "Choose how valifetch reads a response with responseType: JSON, text, Blob, ArrayBuffer, FormData, a stream, the raw Response, or server-sent events."
---

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

Parsing failures for `json`, `text`, `blob`, `arrayBuffer` and `formData` reject with a `PARSE_ERROR`. For `'sse'`, a pending (unterminated) event larger than `sseMaxEventSize` makes the iterator throw a `PARSE_ERROR` (see below).

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

`\n`, `\r` and `\r\n` line endings are all handled, including a `\r\n` pair split across two chunks. A line ending in `\r` is processed as soon as its chunk arrives, so a CR-only server's events are never held back waiting for the next chunk.

Leaving the loop early (`break`, `return` or a throw) cancels the response body, which releases the connection.

### Event size limit

The parser buffers at most `sseMaxEventSize` UTF-16 code units (default 16 MiB, 16,777,216) for a single not-yet-terminated event. The default is generous because real streams (for example AI responses carrying a base64 image) can put megabytes in one event. The cap is checked after each chunk against the pending (unterminated) event only: an event whose terminating blank line arrives in the same chunk is delivered whatever its size. A pending event larger than the cap cancels the stream and the iterator throws a `ValifetchError` with code `PARSE_ERROR`, so a server that never sends a blank line cannot exhaust memory.

```ts
// Instance-wide cap
const api = valifetch.create({ sseMaxEventSize: 1024 * 1024 });

// Per call (the per-call value wins); Infinity disables the cap
const events = await api.get('/stream', {
  responseType: 'sse',
  sseMaxEventSize: Infinity,
});
```

A non-number, `NaN` or negative value falls back to the default. The option is ignored for every other `responseType`.

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
