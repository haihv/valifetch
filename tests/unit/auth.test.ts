import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { basicAuth, bearerAuth, jwtRefresh } from '../../src/auth';
import type { NormalizedOptions } from '../../src/types';

const mockOptions = (): NormalizedOptions => ({
  method: 'GET',
  headers: new Headers(),
  validateResponse: true,
  validateRequest: true,
  throwHttpErrors: true,
});

const makeRequest = (url = 'https://api.example.com') => new Request(url);

describe('auth', () => {
  describe('bearerAuth', () => {
    it('sets Authorization header when token is present', async () => {
      const hook = bearerAuth(() => 'my-token');
      const request = makeRequest();

      await hook(request, mockOptions());

      expect(request.headers.get('Authorization')).toBe('Bearer my-token');
    });

    it('does not set header when getToken returns null', async () => {
      const hook = bearerAuth(() => null);
      const request = makeRequest();

      await hook(request, mockOptions());

      expect(request.headers.get('Authorization')).toBeNull();
    });

    it('does not set header when getToken returns undefined', async () => {
      const hook = bearerAuth(() => undefined);
      const request = makeRequest();

      await hook(request, mockOptions());

      expect(request.headers.get('Authorization')).toBeNull();
    });

    it('calls getToken on every request', async () => {
      let callCount = 0;
      const hook = bearerAuth(() => `token-${++callCount}`);
      const request1 = makeRequest();
      const request2 = makeRequest();

      await hook(request1, mockOptions());
      await hook(request2, mockOptions());

      expect(request1.headers.get('Authorization')).toBe('Bearer token-1');
      expect(request2.headers.get('Authorization')).toBe('Bearer token-2');
    });
  });

  describe('basicAuth', () => {
    it('sets Authorization header with base64-encoded credentials', async () => {
      const hook = basicAuth('user', 'pass');
      const request = makeRequest();

      await hook(request, mockOptions());

      // btoa('user:pass') = 'dXNlcjpwYXNz'
      expect(request.headers.get('Authorization')).toBe('Basic dXNlcjpwYXNz');
    });

    it('encodes credentials once at creation, not on each request', async () => {
      const btoaSpy = vi.spyOn(globalThis, 'btoa');
      const hook = basicAuth('admin', 's3cr3t');
      btoaSpy.mockClear(); // clear the call from hook creation

      const request1 = makeRequest();
      const request2 = makeRequest();
      await hook(request1, mockOptions());
      await hook(request2, mockOptions());

      // btoa should not be called again after hook creation
      expect(btoaSpy).not.toHaveBeenCalled();
      btoaSpy.mockRestore();
    });

    it('handles special characters in password', async () => {
      const hook = basicAuth('user', 'p@$$w0rd!');
      const request = makeRequest();

      await hook(request, mockOptions());

      const header = request.headers.get('Authorization');
      expect(header).toMatch(/^Basic /);
      const decoded = atob(header!.slice(6));
      expect(decoded).toBe('user:p@$$w0rd!');
    });

    it('handles non-Latin1 unicode characters in credentials', async () => {
      const hook = basicAuth('üser', 'pässwörd中');
      const request = makeRequest();

      await hook(request, mockOptions());

      const header = request.headers.get('Authorization');
      expect(header).toMatch(/^Basic /);
      const decodedBytes = Uint8Array.from(atob(header!.slice(6)), (c) =>
        c.charCodeAt(0)
      );
      const decoded = new TextDecoder().decode(decodedBytes);
      expect(decoded).toBe('üser:pässwörd中');
    });
  });

  describe('jwtRefresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sets Authorization header with current token when not expired', async () => {
      const hook = jwtRefresh({
        getToken: () => 'valid-token',
        isExpired: () => false,
        refresh: vi.fn(),
        onRefreshed: vi.fn(),
      });
      const request = makeRequest();

      await hook(request, mockOptions());

      expect(request.headers.get('Authorization')).toBe('Bearer valid-token');
    });

    it('does not call refresh when token is valid', async () => {
      const refresh = vi.fn();
      const hook = jwtRefresh({
        getToken: () => 'valid-token',
        isExpired: () => false,
        refresh,
        onRefreshed: vi.fn(),
      });

      await hook(makeRequest(), mockOptions());

      expect(refresh).not.toHaveBeenCalled();
    });

    it('calls refresh when token is expired and sets new token', async () => {
      const onRefreshed = vi.fn();
      const hook = jwtRefresh({
        getToken: () => 'expired-token',
        isExpired: () => true,
        refresh: vi.fn().mockResolvedValue('new-token'),
        onRefreshed,
      });
      const request = makeRequest();

      await hook(request, mockOptions());

      expect(request.headers.get('Authorization')).toBe('Bearer new-token');
      expect(onRefreshed).toHaveBeenCalledWith('new-token');
    });

    it('calls refresh when getToken returns null', async () => {
      const onRefreshed = vi.fn();
      const refresh = vi.fn().mockResolvedValue('fresh-token');
      const hook = jwtRefresh({
        getToken: () => null,
        isExpired: () => false,
        refresh,
        onRefreshed,
      });
      const request = makeRequest();

      await hook(request, mockOptions());

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(request.headers.get('Authorization')).toBe('Bearer fresh-token');
    });

    it('queues concurrent requests during refresh — only one refresh call', async () => {
      const refresh = vi.fn().mockResolvedValue('refreshed-token');
      const hook = jwtRefresh({
        getToken: () => 'expired-token',
        isExpired: () => true,
        refresh,
        onRefreshed: vi.fn(),
      });

      const r1 = makeRequest();
      const r2 = makeRequest();
      const r3 = makeRequest();

      await Promise.all([
        hook(r1, mockOptions()),
        hook(r2, mockOptions()),
        hook(r3, mockOptions()),
      ]);

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(r1.headers.get('Authorization')).toBe('Bearer refreshed-token');
      expect(r2.headers.get('Authorization')).toBe('Bearer refreshed-token');
      expect(r3.headers.get('Authorization')).toBe('Bearer refreshed-token');
    });

    it('allows a new refresh after the previous one completes', async () => {
      let callCount = 0;
      const refresh = vi
        .fn()
        .mockImplementation(() => Promise.resolve(`token-${++callCount}`));
      let expired = true;
      const hook = jwtRefresh({
        getToken: () => (expired ? 'expired' : `token-${callCount}`),
        isExpired: () => expired,
        refresh,
        onRefreshed: () => {
          expired = false;
        },
      });

      const r1 = makeRequest();
      await hook(r1, mockOptions());
      expect(r1.headers.get('Authorization')).toBe('Bearer token-1');

      // Token is now valid — no second refresh
      const r2 = makeRequest();
      await hook(r2, mockOptions());
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('works when onRefreshed is omitted', async () => {
      const hook = jwtRefresh({
        getToken: () => 'expired-token',
        isExpired: () => true,
        refresh: vi.fn().mockResolvedValue('new-token'),
      });
      const request = makeRequest();

      await hook(request, mockOptions());

      expect(request.headers.get('Authorization')).toBe('Bearer new-token');
    });

    it('awaits an async onRefreshed before attaching the token', async () => {
      const order: string[] = [];
      const hook = jwtRefresh({
        getToken: () => 'expired-token',
        isExpired: () => true,
        refresh: vi.fn().mockResolvedValue('new-token'),
        onRefreshed: async (token) => {
          await Promise.resolve();
          order.push(`persisted:${token}`);
        },
      });
      const request = makeRequest();

      await hook(request, mockOptions());
      order.push('attached');

      expect(order).toEqual(['persisted:new-token', 'attached']);
      expect(request.headers.get('Authorization')).toBe('Bearer new-token');
    });
  });
});
