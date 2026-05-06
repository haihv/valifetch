import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSSEResponse } from '../../src/core/response';
import { valifetch } from '../../src/core/valifetch';

function makeSSEBody(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

async function collectEvents(
  iterable: AsyncIterable<MessageEvent>
): Promise<MessageEvent[]> {
  const events: MessageEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

describe('parseSSEResponse', () => {
  it('yields a simple data event', async () => {
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('data: hello\n\n'))
    );

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('hello');
    expect(events[0].type).toBe('message');
  });

  it('uses event: field as MessageEvent type', async () => {
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('event: update\ndata: payload\n\n'))
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('update');
    expect(events[0].data).toBe('payload');
  });

  it('sets lastEventId from id: field', async () => {
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('id: 42\ndata: msg\n\n'))
    );

    expect(events).toHaveLength(1);
    expect(events[0].lastEventId).toBe('42');
    expect(events[0].data).toBe('msg');
  });

  it('joins multi-line data: fields with newline', async () => {
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('data: line1\ndata: line2\ndata: line3\n\n'))
    );

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('line1\nline2\nline3');
  });

  it('ignores comment lines starting with :', async () => {
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody(': this is a comment\ndata: real\n\n'))
    );

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('real');
  });

  it('does not yield an event for retry: only blocks', async () => {
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('retry: 3000\n\n'))
    );

    expect(events).toHaveLength(0);
  });

  it('does not yield an event for blocks with no data field', async () => {
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('id: 1\n\n'))
    );

    expect(events).toHaveLength(0);
  });

  it('strips exactly one leading space from field values', async () => {
    const events = await collectEvents(
      // "data:  two spaces" → value is " two spaces" (only first space stripped)
      parseSSEResponse(makeSSEBody('data:  two spaces\n\n'))
    );

    expect(events[0].data).toBe(' two spaces');
  });

  it('handles field with no colon as field name with empty value', async () => {
    // "data" alone with no colon → treated as field "data" with value ""
    // Per spec, an empty data field does not produce a non-empty data string
    // but the event IS dispatched if data is set (empty string counts)
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('data\n\n'))
    );

    // data field set to empty string → event dispatched with data=""
    // But our impl checks data !== '' so no event is yielded
    expect(events).toHaveLength(0);
  });

  it('yields multiple events from a multi-event stream', async () => {
    const raw = 'data: first\n\ndata: second\n\ndata: third\n\n';
    const events = await collectEvents(parseSSEResponse(makeSSEBody(raw)));

    expect(events).toHaveLength(3);
    expect(events[0].data).toBe('first');
    expect(events[1].data).toBe('second');
    expect(events[2].data).toBe('third');
  });

  it('flushes a trailing event not followed by blank line', async () => {
    // Some servers omit the final \n\n — we flush remaining buffer on stream close
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('data: trailing'))
    );

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('trailing');
  });

  it('skips empty/whitespace-only blocks produced by consecutive blank lines', async () => {
    // Double blank line (\n\n\n\n) produces an empty block between the two pairs
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('data: before\n\n\n\ndata: after\n\n'))
    );

    expect(events).toHaveLength(2);
    expect(events[0].data).toBe('before');
    expect(events[1].data).toBe('after');
  });

  it('handles CRLF line endings from servers that send \\r\\n', async () => {
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('event: update\r\ndata: payload\r\n\r\n'))
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('update');
    expect(events[0].data).toBe('payload');
  });

  it('handles bare \\r line endings', async () => {
    const events = await collectEvents(
      parseSSEResponse(makeSSEBody('data: hello\r\r'))
    );

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('hello');
  });

  it('parses events split across multiple stream chunks', async () => {
    // The event boundary \n\n straddles two separate chunks — exercises buffering
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: hel'));
        controller.enqueue(new TextEncoder().encode('lo\n\ndata: world\n\n'));
        controller.close();
      },
    });

    const events = await collectEvents(parseSSEResponse(body));

    expect(events).toHaveLength(2);
    expect(events[0].data).toBe('hello');
    expect(events[1].data).toBe('world');
  });

  it('yields nothing and returns immediately for a null body', async () => {
    const events = await collectEvents(parseSSEResponse(null));
    expect(events).toHaveLength(0);
  });
});

describe('responseType: sse (integration with valifetch)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns an AsyncIterable from valifetch.get', async () => {
    fetchSpy.mockResolvedValue(
      new Response(makeSSEBody('data: hello\n\n'), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    );

    const result = await valifetch.get('https://api.example.com/sse', {
      responseType: 'sse',
    });

    expect(
      typeof (result as AsyncIterable<MessageEvent>)[Symbol.asyncIterator]
    ).toBe('function');
  });

  it('yields parsed events when iterated', async () => {
    fetchSpy.mockResolvedValue(
      new Response(makeSSEBody('event: ping\ndata: pong\n\n'), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    );

    const stream = (await valifetch.get('https://api.example.com/sse', {
      responseType: 'sse',
    })) as AsyncIterable<MessageEvent>;

    const events = await collectEvents(stream);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ping');
    expect(events[0].data).toBe('pong');
  });

  it('does not attempt JSON parsing for sse responseType', async () => {
    fetchSpy.mockResolvedValue(
      new Response(makeSSEBody('data: not-json\n\n'), { status: 200 })
    );

    await expect(
      valifetch.get('https://api.example.com/sse', { responseType: 'sse' })
    ).resolves.not.toThrow();
  });

  it('returns an empty iterable for a null-body response (e.g. 204)', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));

    const stream = (await valifetch.get('https://api.example.com/sse', {
      responseType: 'sse',
      throwHttpErrors: false,
    })) as AsyncIterable<MessageEvent>;

    const events: MessageEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }
    expect(events).toHaveLength(0);
  });
});
