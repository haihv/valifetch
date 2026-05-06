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
 * Throw a `ValifetchError` with code `HTTP_ERROR` when the response status is not OK.
 * No-ops when `throwHttpErrors` is `false`.
 * @param response - The fetch `Response`
 * @param request - The originating `Request`
 * @param throwHttpErrors - Whether to throw on non-2xx responses
 */
export function checkResponseStatus(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): void {
  if (!response.ok && throwHttpErrors) {
    throw new ValifetchError({
      message: `Request failed with status ${response.status}: ${response.statusText}`,
      code: 'HTTP_ERROR',
      request,
      response,
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
  try {
    data = await response.json();
  } catch (error) {
    throw new ValifetchError({
      message: 'Failed to parse response as JSON',
      code: 'PARSE_ERROR',
      request,
      response,
      cause: error instanceof Error ? error : undefined,
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
 * Parses a Server-Sent Events (SSE) response body into an `AsyncIterable<MessageEvent>`.
 *
 * Each SSE event block (separated by a blank line) is decoded according to the
 * [SSE specification](https://html.spec.whatwg.org/multipage/server-sent-events.html):
 * - `data:` lines accumulate and are joined with `\n`
 * - `event:` sets the event type (default `'message'`)
 * - `id:` sets `lastEventId`
 * - `retry:` is parsed but not yielded (reconnect hint, not applicable to a one-shot fetch)
 * - Lines starting with `:` are comments and are ignored
 *
 * @param body - The raw `ReadableStream<Uint8Array>` from `response.body`
 * @returns An `AsyncIterable<MessageEvent>` that yields one event per SSE frame
 */
export async function* parseSSEResponse(
  body: ReadableStream<Uint8Array>
): AsyncIterable<MessageEvent> {
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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;

      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        yield* dispatchEvent(block);
      }
    }

    // Flush any trailing event that wasn't followed by a blank line
    if (buffer.trim()) {
      yield* dispatchEvent(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Wraps a Response so that `onDownloadProgress` is called as body bytes arrive.
 * Reads `Content-Length` for total; percent is omitted when the header is absent.
 * Returns the original response unchanged when its body is null.
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
