import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { valifetch } from '../../src/core/valifetch';

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

  it('should not emit an unhandled rejection when a deduped request fails', async () => {
    // Arrange
    mockFetch({ message: 'boom' }, 500);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    // Act
    await valifetch
      .get('https://api.example.com/broken', { dedupe: true, retry: false })
      .catch(() => undefined);
    // Unhandled rejections are reported on a later macrotask tick
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);

    // Assert
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('should not deduplicate requests with different HTTP methods', async () => {
    mockFetch({ id: 1 });

    await Promise.all([
      valifetch.get('https://api.example.com/users/1', { dedupe: true }),
      valifetch.post('https://api.example.com/users/1', { dedupe: true }),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should not deduplicate requests that differ only in search params', async () => {
    mockFetch({ id: 1 });

    await Promise.all([
      valifetch.get('https://api.example.com/users', {
        dedupe: true,
        searchParams: { page: 1 },
      }),
      valifetch.get('https://api.example.com/users', {
        dedupe: true,
        searchParams: { page: 2 },
      }),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should deduplicate on the resolved URL, not the raw path', async () => {
    mockFetch({ id: 1 });
    const api = valifetch.create({
      prefixUrl: 'https://api.example.com',
      dedupe: true,
    });

    await Promise.all([
      api.get('/users/:id', { params: { id: 1 } }),
      api.get('/users/1'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should not share in-flight requests between instances', async () => {
    mockFetch({ id: 1 });
    const first = valifetch.create({
      prefixUrl: 'https://api.example.com',
      dedupe: true,
    });
    const second = valifetch.create({
      prefixUrl: 'https://other.example.com',
      dedupe: true,
    });

    await Promise.all([first.get('/users'), second.get('/users')]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should skip deduplication when the URL cannot be resolved', async () => {
    mockFetch({ id: 1 });

    // Relative path with no prefixUrl: the key cannot be built, and the real
    // failure still comes from buildRequest.
    await expect(valifetch.get('/users', { dedupe: true })).rejects.toThrow(
      'Invalid URL'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
