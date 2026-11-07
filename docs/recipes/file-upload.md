# File upload

## Multipart upload

Pass a `FormData` as `form`. The `Content-Type` is set automatically with the correct multipart boundary; do not set it yourself.

```ts
const formData = new FormData();
formData.append('file', file);
formData.append('name', 'avatar');

const result = await api.post('/upload', {
  form: formData,
  timeout: 60_000, // generous timeout for a large file
  responseSchema: UploadResultSchema,
});
```

`form` also accepts `URLSearchParams` or a plain string record, which are sent as `application/x-www-form-urlencoded`.

## Raw bytes and streams

For a binary payload that is not a form, use the raw `body` option and set the `Content-Type` yourself:

```ts
await api.put('/blobs/abc', {
  body: new Blob([bytes]),
  headers: { 'content-type': 'application/octet-stream' },
});

// A ReadableStream body: `duplex: 'half'` is added automatically
await api.put('/blobs/abc', {
  body: fileStream,
  headers: { 'content-type': 'application/octet-stream' },
});
```

Retries re-send the body. A `ReadableStream` is teed on clone, which buffers it in memory, so pass `retry: false` for large streamed uploads. PUT is retried by default and POST is not; see [Retry](/guide/retry).

## Progress

valifetch supports **download** progress only (`onDownloadProgress`, see [Responses](/guide/responses#download-progress)). It has no upload progress option.

The reason is the platform: native `fetch`, which valifetch is built on, does not expose upload progress events. The only way to observe upload progress is an `XMLHttpRequest`, which valifetch deliberately does not use, since the library is built on `fetch` end to end.

If you need an upload progress bar:

- Use `XMLHttpRequest` (or a library that wraps it) for that specific upload and keep valifetch for everything else.
- Or, where your runtime supports streaming request bodies, count the bytes of a `ReadableStream` body as it is consumed:

```ts
function withProgress(
  stream: ReadableStream<Uint8Array>,
  onProgress: (sentBytes: number) => void
): ReadableStream<Uint8Array> {
  let sent = 0;
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        sent += chunk.byteLength;
        onProgress(sent);
        controller.enqueue(chunk);
      },
    })
  );
}

await api.put('/blobs/abc', {
  body: withProgress(fileStream, (n) => console.log(`${n} bytes handed to fetch`)),
  headers: { 'content-type': 'application/octet-stream' },
  retry: false,
});
```

::: warning Caveats of the streaming approach
The count is bytes handed to `fetch`, not bytes acknowledged by the server. Streaming request bodies are not supported by every browser or protocol version (some require HTTP/2 or HTTP/3), and you lose the `Content-Length` header, which some servers require. Test it against your target runtimes and servers.
:::
