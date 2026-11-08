---
description: "Consume server-sent events and AI token streams, such as OpenAI-style chat completions, with valifetch responseType sse as an async iterable."
---

# SSE and AI streaming

`responseType: 'sse'` resolves to an `AsyncIterable<MessageEvent>`. valifetch parses the server-sent events frame protocol for you, so there is no manual chunk decoding.

## Basic consumption

```ts
const events = await valifetch.get('https://api.example.com/stream', {
  responseType: 'sse',
});

for await (const event of events) {
  console.log(event.type, event.data); // event.type defaults to 'message'
}
```

Each `MessageEvent` has `type` (from `event:`, default `'message'`), `data` (multiple `data:` lines joined), and `lastEventId` (from `id:`). Comment lines and `retry:` hints are consumed but not yielded.

## Consuming an OpenAI-style event stream

Chat completion APIs stream JSON chunks as SSE `data:` frames and end with a literal `[DONE]` sentinel. Validate each chunk with Valibot:

```ts
import valifetch from 'valifetch';
import * as v from 'valibot';

const ChunkSchema = v.object({
  choices: v.array(
    v.object({
      delta: v.object({ content: v.optional(v.string()) }),
    })
  ),
});

const api = valifetch.create({
  prefixUrl: 'https://api.openai.com/v1',
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
});

async function streamCompletion(prompt: string): Promise<string> {
  const events = await api.post('/chat/completions', {
    json: {
      model: 'gpt-4o-mini',
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    },
    responseType: 'sse',
  });

  let text = '';
  for await (const event of events) {
    if (event.data === '[DONE]') break;

    const chunk = v.parse(ChunkSchema, JSON.parse(event.data));
    const piece = chunk.choices[0]?.delta.content ?? '';
    text += piece;
    process.stdout.write(piece);
  }
  return text;
}
```

The model name and chunk shape belong to the provider's API; adjust them to the service you call. The pattern is the same for any provider that streams JSON over SSE.

The `break` on `[DONE]` is safe: leaving the `for await` loop early (`break`, `return` or a throw) cancels the response body, so the connection is released even if the server keeps the stream open.

## Cancelling a stream

Pass an `AbortSignal` to stop a stream from the outside, or call `.cancel()` on the request promise before it resolves.

```ts
const controller = new AbortController();

const events = await api.post('/chat/completions', {
  json: { model: 'gpt-4o-mini', stream: true, messages },
  responseType: 'sse',
  signal: controller.signal,
});

setTimeout(() => controller.abort(), 5_000);

try {
  for await (const event of events) {
    // ...
  }
} catch (error) {
  // Aborting mid-stream ends the iteration with an error; handle it here
}
```

## Things to know

- `timeout` is cleared as soon as the response headers arrive, so it does not cut off a long-lived stream. Use a signal to stop one.
- A single event is capped at `sseMaxEventSize` UTF-16 code units (default 16 MiB). A larger one cancels the stream and throws a `PARSE_ERROR`. Raise it (or pass `Infinity`) for providers that send very large events; see [Responses](/guide/responses#event-size-limit).
- `onDownloadProgress` and `afterParseResponse` do not run for `'sse'`. The caller owns the body.
- Retries apply to establishing the connection (a failed status or network error), not to an interrupted stream. Resuming from `lastEventId` is up to you.
