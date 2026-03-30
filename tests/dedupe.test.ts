import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { valifetch } from '../src/core/valifetch';

describe('request deduplication', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  // Each call must return a fresh Response — body streams can only be read once
  const mockFetch = (body: unknown = {}, status = 200) => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
  };

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should share one in-flight promise for concurrent identical requests when dedupe: true', async () => {
    mockFetch({ id: 1 });

    const [r1, r2] = await Promise.all([
      valifetch.get('https://api.example.com/users/1', { dedupe: true }),
      valifetch.get('https://api.example.com/users/1', { dedupe: true }),
    ]);

    // Only one actual network request made
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Both callers get the same result
    expect(r1).toEqual(r2);
  });

  it('should NOT deduplicate requests to different URLs', async () => {
    mockFetch({ id: 1 });

    await Promise.all([
      valifetch.get('https://api.example.com/users/1', { dedupe: true }),
      valifetch.get('https://api.example.com/users/2', { dedupe: true }),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should NOT deduplicate by default (dedupe: false)', async () => {
    mockFetch({ id: 1 });

    await Promise.all([
      valifetch.get('https://api.example.com/users/1'),
      valifetch.get('https://api.example.com/users/1'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should make a fresh request after the previous one settles', async () => {
    mockFetch({ id: 1 });

    // First request
    await valifetch.get('https://api.example.com/users/1', { dedupe: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second request — previous promise has settled, cache cleared
    await valifetch.get('https://api.example.com/users/1', { dedupe: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should support dedupe set at instance level', async () => {
    mockFetch({ id: 1 });

    const api = valifetch.create({ dedupe: true });

    await Promise.all([
      api.get('https://api.example.com/users/1'),
      api.get('https://api.example.com/users/1'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should not deduplicate requests with different HTTP methods', async () => {
    mockFetch({ id: 1 });

    await Promise.all([
      valifetch.get('https://api.example.com/users/1', { dedupe: true }),
      valifetch.post('https://api.example.com/users/1', { dedupe: true }),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
