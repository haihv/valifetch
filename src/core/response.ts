import type { GenericSchema, InferOutput } from 'valibot';
import { ValifetchError } from '../errors/ValifetchError';
import type { DownloadProgressEvent } from '../types/options';
import { validate } from '../validation/validate';

/** Options passed to response-parsing helpers */
export type HandleResponseOptions = {
  /** The fetch Response to process */
  response: Response;
  /** The originating Request */
  request: Request;
  /** Optional Valibot schema to validate the parsed body against */
  responseSchema?: GenericSchema;
  /** Whether to validate the response body against the schema */
  validateResponse: boolean;
  /** Whether to throw on non-2xx status codes */
  throwHttpErrors: boolean;
};

/**
 * Attempt to read the error response body as JSON, falling back to text.
 * Clones the response so the original stream is not consumed.
 * Returns `undefined` when the body cannot be read.
 */
async function parseErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    try {
      return (await response.clone().text()) || undefined;
    } catch {
      /* v8 ignore next 1 */
      return undefined;
    }
  }
}

/**
 * Throw a `ValifetchError` with code `HTTP_ERROR` when the response status is not OK.
 * On error, the parsed response body is attached to `error.responseBody`.
 * No-ops when `throwHttpErrors` is `false`.
 * @param response - The fetch `Response`
 * @param request - The originating `Request`
 * @param throwHttpErrors - Whether to throw on non-2xx responses
 * @returns A promise that resolves when the response is OK (or `throwHttpErrors` is `false`); otherwise rejects with `ValifetchError`
 */
export async function checkResponseStatus(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): Promise<void> {
  if (!response.ok && throwHttpErrors) {
    const responseBody = await parseErrorBody(response);
    throw new ValifetchError({
      message: `Request failed with status ${response.status}: ${response.statusText}`,
      code: 'HTTP_ERROR',
      request,
      response,
      responseBody,
    });
  }
}

/**
 * Parse the response body as JSON and optionally validate it against a Valibot schema.
 * @param options - Parsing options including the response, request, and optional schema
 * @returns The parsed (and optionally validated) response data
 */
export async function parseJsonResponse<T extends GenericSchema>(
  options: HandleResponseOptions
): Promise<InferOutput<T>> {
  const { response, request, responseSchema, validateResponse } = options;

  let data: unknown;
  let text: string | undefined;
  try {
    text = await response.text();
    data = JSON.parse(text);
  } catch (error) {
    throw new ValifetchError({
      message: 'Failed to parse response as JSON',
      code: 'PARSE_ERROR',
      request,
      response,
      cause: error,
      responseBody: text,
    });
  }

  if (responseSchema && validateResponse) {
    return validate({
      schema: responseSchema,
      data,
      target: 'response',
      request,
      response,
    });
  }

  return data as InferOutput<T>;
}

/**
 * Default largest pending (not yet terminated) SSE event the parser buffers, in
 * UTF-16 code units (16 MiB of ASCII). Generous because legitimate streams (e.g.
 * AI responses) can carry a base64 image in one event; a stream that never sends
 * a blank line would otherwise grow the buffer without bound. Override per
 * instance or per call with the `sseMaxEventSize` option.
 */
export const MAX_SSE_EVENT_SIZE = 16 * 1024 * 1024;

/**
 * Parses a Server-Sent Events (SSE) response body into an `AsyncIterable<MessageEvent>`.
 *
 * Each SSE event block (separated by a blank line) is decoded according to the
 * [SSE specification](https://html.spec.whatwg.org/multipage/server-sent-events.html):
 * - `data:` lines accumulate and are joined with `\n`
 * - `event:` sets the event type (default `'message'`)
 * - `id:` sets `lastEventId`
 * - `retry:` is parsed but not yielded (reconnect hint, not applicable to a one-shot fetch)
 * - Lines starting with `:` are comments and are ignored
 * - Handles `\n`, `\r`, and `\r\n` line endings per the SSE spec, including a
 *   `\r\n` pair split across two chunks. A chunk ending in `\r` terminates its
 *   line immediately (no wait for the next chunk); a `\n` opening the next chunk
 *   is then dropped as the second half of that `\r\n`
 *
 * A single event larger than `maxEventSize` cancels the stream and throws a
 * `ValifetchError` with code `PARSE_ERROR`, bounding memory use against a
 * hostile or broken server. Pass `Infinity` to disable the cap.
 *
 * Leaving the iteration early (`break`, `return`, or a thrown error in the loop
 * body) cancels the underlying response body so the connection is released.
 *
 * Yields nothing and returns immediately when `body` is `null`
 * (e.g. a 204 No Content response).
 *
 * @param body - The raw `ReadableStream<Uint8Array>` from `response.body`, or `null`
 * @param maxEventSize - Largest pending event to buffer, in UTF-16 code units (default {@link MAX_SSE_EVENT_SIZE})
 * @param request - The originating request, attached to a size-limit error
 * @param response - The response being parsed, attached to a size-limit error
 * @returns An `AsyncIterable<MessageEvent>` that yields one event per SSE frame
 */
export async function* parseSSEResponse(
  body: ReadableStream<Uint8Array> | null,
  maxEventSize: number = MAX_SSE_EVENT_SIZE,
  request?: Request,
  response?: Response
): AsyncIterable<MessageEvent> {
  if (!body) return;

  // TextDecoderStream's writable is typed as WritableStream<BufferSource> but Uint8Array
  // satisfies that contract at runtime. The cast silences the TS dom-lib mismatch.
  const reader = body
    .pipeThrough(
      new TextDecoderStream() as unknown as ReadableWritablePair<
        string,
        Uint8Array
      >
    )
    .getReader();
  let buffer = '';
  // Where the next `\n\n` search starts: everything before it was already
  // scanned, so each chunk costs O(chunk) instead of O(buffer).
  let scanFrom = 0;
  // A chunk ending in `\r` may be the first half of a `\r\n` pair. The `\r`
  // already ended the line, so a `\n` opening the next chunk must be dropped
  // rather than read as a second (blank) line, which would split the event.
  let skipLeadingLF = false;
  // Whether the stream was read to its end; otherwise it is cancelled on exit.
  let finished = false;

  const dispatchEvent = function* (block: string): Iterable<MessageEvent> {
    if (!block.trim()) return;

    let data = '';
    let eventType = 'message';
    let lastEventId = '';

    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;

      const colonIndex = line.indexOf(':');
      const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
      // RFC: if colon is present, strip exactly one leading space from value
      const rawValue = colonIndex === -1 ? '' : line.slice(colonIndex + 1);
      const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

      if (field === 'data') {
        data = data === '' ? value : `${data}\n${value}`;
      } else if (field === 'event') {
        eventType = value;
      } else if (field === 'id') {
        lastEventId = value;
      }
      // 'retry' field is intentionally ignored for one-shot fetch usage
    }

    if (data !== '') {
      yield new MessageEvent(eventType, { data, lastEventId });
    }
  };

  // Normalise incoming text to \n-only so event boundary detection (\n\n)
  // works regardless of whether the server sends \r\n or \r line endings.
  const normalise = (s: string) =>
    s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        break;
      }

      // TextDecoderStream never enqueues empty strings, so `value` is non-empty.
      const chunk: string =
        skipLeadingLF && value.startsWith('\n') ? value.slice(1) : value;
      skipLeadingLF = chunk.endsWith('\r');
      buffer += normalise(chunk);

      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n', scanFrom)) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        scanFrom = 0;
        yield* dispatchEvent(block);
      }
      // Back off one char: the buffer may end in the first `\n` of a boundary.
      scanFrom = Math.max(0, buffer.length - 1);

      if (buffer.length > maxEventSize) {
        // The finally block cancels the stream.
        throw new ValifetchError({
          message: `SSE event exceeds the ${maxEventSize}-character limit`,
          code: 'PARSE_ERROR',
          request,
          response,
        });
      }
    }

    // Flush any trailing event that wasn't followed by a blank line
    if (buffer.trim()) {
      yield* dispatchEvent(buffer);
    }
  } finally {
    // Early exit (consumer `break`, size limit, read error): cancel so the
    // source body and its connection are released instead of left dangling.
    // A cancel on an already-errored stream rejects; that error is moot here.
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * Wraps a Response so that `onDownloadProgress` is called as body bytes arrive.
 * Reads `Content-Length` for total; percent is omitted when the header is absent.
 * Returns the original response unchanged when its body is null.
 * @param response - The fetch `Response` to wrap
 * @param onDownloadProgress - Called with `{ loaded, total, percent }` as each chunk arrives
 * @returns A new `Response` whose body streams through the progress callback, or the original response when it has no body
 */
export function wrapResponseWithProgress(
  response: Response,
  onDownloadProgress: (event: DownloadProgressEvent) => void
): Response {
  if (!response.body) return response;

  const contentLength = response.headers.get('content-length');
  const total = contentLength !== null ? Number(contentLength) : undefined;

  let loaded = 0;

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      loaded += chunk.byteLength;
      const percent =
        total !== undefined ? Math.min((loaded / total) * 100, 100) : undefined;
      onDownloadProgress({ loaded, total, percent });
      controller.enqueue(chunk);
    },
  });

  const pipedBody = response.body.pipeThrough(transform);

  return new Response(pipedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
