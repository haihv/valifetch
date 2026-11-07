import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetRequestStreamSupportCache,
  supportsRequestStreams,
} from '../../src/core/stream-support';
import { valifetch } from '../../src/core/valifetch';

/** Mimics an engine like Firefox: ignores `duplex` and infers a text body. */
class StringifyingRequest {
  readonly headers = new Headers({ 'Content-Type': 'text/plain' });
}

/** Mimics Deno: never reads `duplex`, sets no Content-Type, still streams. */
class DuplexIgnoringRequest {
  readonly headers = new Headers();
}

describe('request stream support probe', () => {
  beforeEach(() => {
    resetRequestStreamSupportCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetRequestStreamSupportCache();
  });

  it('reports support on a runtime that streams request bodies', () => {
    expect(supportsRequestStreams()).toBe(true);
  });

  it('reports no support when the engine infers a text body', () => {
    vi.stubGlobal('Request', StringifyingRequest);
    expect(supportsRequestStreams()).toBe(false);
  });

  it('reports support when the engine never reads duplex but infers no Content-Type', () => {
    vi.stubGlobal('Request', DuplexIgnoringRequest);
    expect(supportsRequestStreams()).toBe(true);
  });

  it('caches the first result', () => {
    expect(supportsRequestStreams()).toBe(true);
    vi.stubGlobal('Request', StringifyingRequest);
    expect(supportsRequestStreams()).toBe(true);
  });

  it('rejects with a TypeError for a ReadableStream body where unsupported', async () => {
    vi.stubGlobal('Request', StringifyingRequest);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      valifetch.post('https://api.example.com/raw', {
        body: new ReadableStream<Uint8Array>(),
      })
    ).rejects.toThrow(TypeError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
