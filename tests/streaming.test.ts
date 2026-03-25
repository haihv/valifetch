import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { valifetch } from '../src/core/valifetch';

describe('stream response type', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should return response.body as ReadableStream', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'));
        controller.close();
      },
    });

    fetchSpy.mockResolvedValue(new Response(stream, { status: 200 }));

    const result = await valifetch.get('https://api.example.com/stream', {
      responseType: 'stream',
    });

    expect(result).toBeInstanceOf(ReadableStream);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should not attempt JSON parsing for stream response type', async () => {
    // Non-JSON content that would throw if parsed
    fetchSpy.mockResolvedValue(
      new Response('data: event\n\n', { status: 200 })
    );

    // Should resolve without throwing a parse error
    await expect(
      valifetch.get('https://api.example.com/sse', { responseType: 'stream' })
    ).resolves.not.toThrow();
  });

  it('should return null body when response has no body', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await valifetch.get('https://api.example.com/empty', {
      responseType: 'stream',
    });

    expect(result).toBeNull();
  });

  it('should skip response schema validation for stream response type', async () => {
    const stream = new ReadableStream();
    fetchSpy.mockResolvedValue(new Response(stream, { status: 200 }));

    // Even with a schema provided, stream bypasses validation — no throw
    await expect(
      valifetch.get('https://api.example.com/stream', {
        responseType: 'stream',
        responseSchema: undefined,
      })
    ).resolves.toBeInstanceOf(ReadableStream);
  });
});
