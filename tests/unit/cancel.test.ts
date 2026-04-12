import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { valifetch } from '../../src/core/valifetch';
import { ValifetchError } from '../../src/errors/ValifetchError';

describe('cancellable requests', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // Makes fetch hang until the signal fires (or immediately if already aborted), then rejects with AbortError
  const mockHangingFetch = () => {
    fetchSpy.mockImplementation((_req: Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        const doAbort = () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        if (signal?.aborted) {
          doAbort();
          return;
        }
        signal?.addEventListener('abort', doAbort);
      });
    });
  };

  const mockFetch = (body: unknown, status = 200) => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  };

  describe('cancel method', () => {
    it('is present on the returned promise', () => {
      mockFetch({ id: 1 });
      const req = valifetch.get('https://api.example.com/users/1');
      expect(typeof req.cancel).toBe('function');
    });

    it('aborts the in-flight request and rejects with ABORT_ERROR', async () => {
      mockHangingFetch();

      const req = valifetch.get('https://api.example.com/slow');
      req.cancel();

      const error = await req.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('ABORT_ERROR');
    });

    it('does not affect already-resolved requests', async () => {
      mockFetch({ id: 1 });

      const req = valifetch.get<{ id: number }>(
        'https://api.example.com/users/1'
      );
      const data = await req;
      req.cancel(); // calling cancel after resolution is a no-op

      expect(data).toEqual({ id: 1 });
    });

    it('is present on POST requests', () => {
      mockFetch({ id: 1 });
      const req = valifetch.post('https://api.example.com/users', {
        json: { name: 'John' },
      });
      expect(typeof req.cancel).toBe('function');
    });

    it('is present on PUT requests', () => {
      mockFetch({ id: 1 });
      const req = valifetch.put('https://api.example.com/users/1', {
        json: { name: 'John' },
      });
      expect(typeof req.cancel).toBe('function');
    });

    it('is present on PATCH requests', () => {
      mockFetch({ id: 1 });
      const req = valifetch.patch('https://api.example.com/users/1', {
        json: { name: 'John' },
      });
      expect(typeof req.cancel).toBe('function');
    });

    it('is present on DELETE requests', () => {
      mockFetch({ id: 1 });
      const req = valifetch.delete('https://api.example.com/users/1');
      expect(typeof req.cancel).toBe('function');
    });

    it('is present on HEAD requests', () => {
      mockFetch(null);
      const req = valifetch.head('https://api.example.com/users/1');
      expect(typeof req.cancel).toBe('function');
    });
  });

  describe('signal merging', () => {
    it('respects a user-provided signal alongside cancel', async () => {
      mockHangingFetch();

      const userController = new AbortController();
      const req = valifetch.get('https://api.example.com/slow', {
        signal: userController.signal,
      });

      // Abort via the user's controller, not req.cancel()
      userController.abort();

      const error = await req.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('ABORT_ERROR');
    });

    it('cancel works independently when a user signal is also provided', async () => {
      mockHangingFetch();

      const userController = new AbortController();
      const req = valifetch.get('https://api.example.com/slow', {
        signal: userController.signal,
      });

      req.cancel(); // abort via the built-in cancel, not the user controller

      const error = await req.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('ABORT_ERROR');
    });
  });
});
