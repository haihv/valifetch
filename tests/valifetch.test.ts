import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as v from 'valibot';
import { valifetch } from '../src/core/valifetch';
import { ValifetchError } from '../src/errors/ValifetchError';

describe('core/valifetch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const mockFetch = (body: unknown, status = 200, statusText = 'OK') => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        statusText,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  };

  const mockFetchError = (error: Error) => {
    fetchSpy.mockRejectedValue(error);
  };

  describe('HTTP methods', () => {
    describe('get', () => {
      it('should make GET request', async () => {
        // Arrange
        mockFetch({ id: 1, name: 'John' });

        // Act
        const result = await valifetch.get('https://api.example.com/users/1');

        // Assert
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('GET');
        expect(request.url).toBe('https://api.example.com/users/1');
        expect(result).toEqual({ id: 1, name: 'John' });
      });

      it('should validate response with schema', async () => {
        // Arrange
        mockFetch({ id: 1, name: 'John' });
        const UserSchema = v.object({
          id: v.number(),
          name: v.string(),
        });

        // Act
        const result = await valifetch.get('https://api.example.com/users/1', {
          responseSchema: UserSchema,
        });

        // Assert
        expect(result).toEqual({ id: 1, name: 'John' });
      });

      it('should throw for invalid response when schema provided', async () => {
        // Arrange
        mockFetch({ id: 'not-a-number' });
        const UserSchema = v.object({
          id: v.number(),
        });

        // Act & Assert
        await expect(
          valifetch.get('https://api.example.com/users/1', {
            responseSchema: UserSchema,
          })
        ).rejects.toThrow(ValifetchError);
      });
    });

    describe('post', () => {
      it('should make POST request with JSON body', async () => {
        // Arrange
        mockFetch({ id: 1, name: 'John' }, 201);

        // Act
        const result = await valifetch.post('https://api.example.com/users', {
          json: { name: 'John', email: 'john@example.com' },
        });

        // Assert
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('POST');
        expect(result).toEqual({ id: 1, name: 'John' });
      });

      it('should validate body with schema', async () => {
        // Arrange
        mockFetch({ success: true });
        const BodySchema = v.object({
          name: v.pipe(v.string(), v.minLength(1)),
        });

        // Act
        const result = await valifetch.post('https://api.example.com/users', {
          json: { name: 'John' },
          bodySchema: BodySchema,
        });

        // Assert
        expect(result).toEqual({ success: true });
      });

      it('should throw for invalid body when schema provided', async () => {
        // Arrange
        mockFetch({ success: true });
        const BodySchema = v.object({
          name: v.pipe(v.string(), v.minLength(5)),
        });

        // Act & Assert
        await expect(
          valifetch.post('https://api.example.com/users', {
            json: { name: 'Jo' },
            bodySchema: BodySchema,
          })
        ).rejects.toThrow(ValifetchError);
      });
    });

    describe('put', () => {
      it('should make PUT request', async () => {
        // Arrange
        mockFetch({ id: 1, name: 'John Updated' });

        // Act
        const result = await valifetch.put('https://api.example.com/users/1', {
          json: { name: 'John Updated' },
        });

        // Assert
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('PUT');
        expect(result).toEqual({ id: 1, name: 'John Updated' });
      });
    });

    describe('patch', () => {
      it('should make PATCH request', async () => {
        // Arrange
        mockFetch({ id: 1, name: 'John Patched' });

        // Act
        const result = await valifetch.patch(
          'https://api.example.com/users/1',
          {
            json: { name: 'John Patched' },
          }
        );

        // Assert
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('PATCH');
        expect(result).toEqual({ id: 1, name: 'John Patched' });
      });
    });

    describe('delete', () => {
      it('should make DELETE request', async () => {
        // Arrange
        mockFetch({ success: true });

        // Act
        const result = await valifetch.delete(
          'https://api.example.com/users/1'
        );

        // Assert
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('DELETE');
        expect(result).toEqual({ success: true });
      });
    });

    describe('head', () => {
      it('should make HEAD request and return undefined', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

        // Act
        const result = await valifetch.head('https://api.example.com/users/1');

        // Assert
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('HEAD');
        expect(result).toBeUndefined();
      });
    });

    describe('options', () => {
      it('should make OPTIONS request', async () => {
        // Arrange
        mockFetch({ methods: ['GET', 'POST'] });

        // Act
        const result = await valifetch.options('https://api.example.com/users');

        // Assert
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('OPTIONS');
        expect(result).toEqual({ methods: ['GET', 'POST'] });
      });
    });
  });

  describe('path parameters', () => {
    it('should replace path params', async () => {
      // Arrange
      mockFetch({ id: 123, name: 'John' });
      const api = valifetch.create({ prefixUrl: 'https://api.example.com' });

      // Act
      await api.get('/users/:id', {
        params: { id: 123 },
      });

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.url).toBe('https://api.example.com/users/123');
    });

    it('should validate path params with schema', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const api = valifetch.create({ prefixUrl: 'https://api.example.com' });
      const ParamsSchema = v.object({
        id: v.pipe(v.number(), v.minValue(1)),
      });

      // Act
      await api.get('/users/:id', {
        params: { id: 5 },
        paramsSchema: ParamsSchema,
      });

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.url).toBe('https://api.example.com/users/5');
    });
  });

  describe('search parameters', () => {
    it('should add search params to URL', async () => {
      // Arrange
      mockFetch([{ id: 1 }]);
      const api = valifetch.create({ prefixUrl: 'https://api.example.com' });

      // Act
      await api.get('/users', {
        searchParams: { page: 1, limit: 10 },
      });

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.url).toContain('page=1');
      expect(request.url).toContain('limit=10');
    });
  });

  describe('response types', () => {
    it('should return text when responseType is text', async () => {
      // Arrange
      fetchSpy.mockResolvedValue(
        new Response('Hello, World!', { status: 200 })
      );

      // Act
      const result = await valifetch.get('https://example.com', {
        responseType: 'text',
      });

      // Assert
      expect(result).toBe('Hello, World!');
    });

    it('should return blob when responseType is blob', async () => {
      // Arrange
      const blob = new Blob(['data'], { type: 'application/octet-stream' });
      fetchSpy.mockResolvedValue(new Response(blob, { status: 200 }));

      // Act
      const result = await valifetch.get('https://example.com/file', {
        responseType: 'blob',
      });

      // Assert
      expect(result).toBeInstanceOf(Blob);
    });

    it('should return ArrayBuffer when responseType is arrayBuffer', async () => {
      // Arrange
      const data = new Uint8Array([1, 2, 3]);
      fetchSpy.mockResolvedValue(new Response(data, { status: 200 }));

      // Act
      const result = await valifetch.get('https://example.com/binary', {
        responseType: 'arrayBuffer',
      });

      // Assert
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should return Response when responseType is raw', async () => {
      // Arrange
      fetchSpy.mockResolvedValue(new Response('data', { status: 200 }));

      // Act
      const result = await valifetch.get('https://example.com', {
        responseType: 'raw',
      });

      // Assert
      expect(result).toBeInstanceOf(Response);
    });

    it('should return FormData when responseType is formData', async () => {
      // Arrange
      const formData = new FormData();
      formData.append('name', 'test');
      fetchSpy.mockResolvedValue(new Response(formData, { status: 200 }));

      // Act
      const result = await valifetch.get('https://example.com/form', {
        responseType: 'formData',
      });

      // Assert
      expect(result).toBeInstanceOf(FormData);
    });
  });

  describe('error handling', () => {
    describe('HTTP errors', () => {
      it('should throw ValifetchError for 4xx status', async () => {
        // Arrange
        mockFetch({ error: 'Not Found' }, 404, 'Not Found');

        // Act & Assert
        await expect(
          valifetch.get('https://api.example.com/users/999')
        ).rejects.toThrow(ValifetchError);
      });

      it('should throw ValifetchError for 5xx status', async () => {
        // Arrange
        mockFetch({ error: 'Server Error' }, 500, 'Internal Server Error');

        // Act & Assert
        await expect(
          valifetch.get('https://api.example.com/users')
        ).rejects.toThrow(ValifetchError);
      });

      it('should not throw when throwHttpErrors is false', async () => {
        // Arrange
        mockFetch({ error: 'Not Found' }, 404, 'Not Found');

        // Act
        const result = await valifetch.get(
          'https://api.example.com/users/999',
          {
            throwHttpErrors: false,
          }
        );

        // Assert
        expect(result).toEqual({ error: 'Not Found' });
      });
    });

    describe('network errors', () => {
      it('should throw ValifetchError for network failure', async () => {
        // Arrange
        mockFetchError(new Error('Network failure'));

        // Act & Assert
        try {
          await valifetch.get('https://api.example.com/users', {
            retry: false,
          });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect((error as ValifetchError).code).toBe('NETWORK_ERROR');
        }
      });

      it('should retry on network errors and eventually succeed', async () => {
        // Arrange
        let callCount = 0;
        fetchSpy.mockImplementation(() => {
          callCount++;
          if (callCount < 2) {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve(
            new Response('{"success": true}', { status: 200 })
          );
        });

        // Act
        const result = await valifetch.get('https://api.example.com/unstable', {
          retry: {
            limit: 3,
            methods: ['GET'],
            statusCodes: [500],
            delay: () => 1,
          },
        });

        // Assert
        expect(callCount).toBe(2);
        expect(result).toEqual({ success: true });
      }, 10000);

      it('should rethrow non-Error objects', async () => {
        // Arrange
        fetchSpy.mockRejectedValue('string error');

        // Act & Assert
        await expect(
          valifetch.get('https://api.example.com/users', { retry: false })
        ).rejects.toBe('string error');
      });
    });

    describe('abort errors', () => {
      it('should throw ValifetchError when request is aborted', async () => {
        // Arrange
        const abortError = new Error('Aborted');
        abortError.name = 'AbortError';
        mockFetchError(abortError);

        // Act & Assert
        try {
          await valifetch.get('https://api.example.com/users');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect((error as ValifetchError).code).toBe('ABORT_ERROR');
        }
      });
    });
  });

  describe('timeout', () => {
    it('should handle timeout option being passed', async () => {
      // Arrange
      mockFetch({ id: 1 });

      // Act
      const result = await valifetch.get('https://api.example.com/users', {
        timeout: 5000,
      });

      // Assert
      expect(result).toEqual({ id: 1 });
    });

    it('should abort via user signal when timeout is also set', async () => {
      // Arrange
      const controller = new AbortController();
      fetchSpy.mockImplementation(() => {
        controller.abort(new Error('User aborted'));
        return Promise.reject(
          Object.assign(new Error('Aborted'), { name: 'AbortError' })
        );
      });

      // Act & Assert
      await expect(
        valifetch.get('https://api.example.com/slow', {
          timeout: 10000,
          signal: controller.signal,
          retry: false,
        })
      ).rejects.toThrow(ValifetchError);
    });

    it('should throw timeout error when request exceeds timeout', async () => {
      // Arrange
      fetchSpy.mockImplementation((_req, init) => {
        return new Promise((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const error = new Error('Aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }
        });
      });

      // Act & Assert
      try {
        await valifetch.get('https://api.example.com/slow', {
          timeout: 50,
          retry: false,
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValifetchError);
        expect((error as ValifetchError).code).toBe('TIMEOUT_ERROR');
      }
    }, 10000);
  });

  describe('retry', () => {
    it('should retry on retryable status codes', async () => {
      // Arrange
      let callCount = 0;
      fetchSpy.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve(new Response('Error', { status: 500 }));
        }
        return Promise.resolve(
          new Response('{"success": true}', { status: 200 })
        );
      });

      // Act
      const result = await valifetch.get('https://api.example.com/unstable', {
        retry: {
          limit: 3,
          methods: ['GET'],
          statusCodes: [500],
          delay: () => 1,
        },
      });

      // Assert
      expect(callCount).toBe(3);
      expect(result).toEqual({ success: true });
    }, 10000); // Extend timeout for retry tests

    it('should not retry when retry is false', async () => {
      // Arrange
      mockFetch({ error: 'Server Error' }, 500, 'Internal Server Error');

      // Act & Assert
      await expect(
        valifetch.get('https://api.example.com/users', { retry: false })
      ).rejects.toThrow(ValifetchError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should not retry POST by default', async () => {
      // Arrange
      mockFetch({ error: 'Server Error' }, 500, 'Internal Server Error');

      // Act & Assert
      await expect(
        valifetch.post('https://api.example.com/users', { json: {} })
      ).rejects.toThrow(ValifetchError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('hooks', () => {
    describe('beforeRequest', () => {
      it('should call beforeRequest hook', async () => {
        // Arrange
        mockFetch({ id: 1 });
        const beforeRequestHook = vi.fn();
        const api = valifetch.create({
          prefixUrl: 'https://api.example.com',
          hooks: {
            beforeRequest: [beforeRequestHook],
          },
        });

        // Act
        await api.get('/users/1');

        // Assert
        expect(beforeRequestHook).toHaveBeenCalled();
      });

      it('should allow hook to return cached Response', async () => {
        // Arrange
        const cachedResponse = new Response('{"cached": true}', {
          status: 200,
        });
        const beforeRequestHook = vi.fn().mockReturnValue(cachedResponse);
        const api = valifetch.create({
          prefixUrl: 'https://api.example.com',
          hooks: {
            beforeRequest: [beforeRequestHook],
          },
        });

        // Act
        const result = await api.get('/users/1');

        // Assert
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result).toEqual({ cached: true });
      });
    });

    describe('afterResponse', () => {
      it('should call afterResponse hook', async () => {
        // Arrange
        mockFetch({ id: 1 });
        const afterResponseHook = vi.fn();
        const api = valifetch.create({
          prefixUrl: 'https://api.example.com',
          hooks: {
            afterResponse: [afterResponseHook],
          },
        });

        // Act
        await api.get('/users/1');

        // Assert
        expect(afterResponseHook).toHaveBeenCalled();
      });
    });
  });

  describe('create instance', () => {
    it('should create instance with default options', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const api = valifetch.create({
        prefixUrl: 'https://api.example.com',
        headers: {
          Authorization: 'Bearer token123',
        },
      });

      // Act
      await api.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.url).toBe('https://api.example.com/users/1');
      expect(request.headers.get('Authorization')).toBe('Bearer token123');
    });
  });

  describe('extend instance', () => {
    it('should extend instance with additional options', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        headers: {
          Authorization: 'Bearer token123',
        },
      });
      const extendedApi = baseApi.extend({
        headers: {
          'X-Custom': 'value',
        },
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.headers.get('Authorization')).toBe('Bearer token123');
      expect(request.headers.get('X-Custom')).toBe('value');
    });

    it('should extend instance with function', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend((parent) => ({
        ...parent,
        headers: {
          'X-Dynamic': 'dynamic-value',
        },
      }));

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.headers.get('X-Dynamic')).toBe('dynamic-value');
    });

    it('should merge hooks when extending', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const parentHook = vi.fn();
      const childHook = vi.fn();

      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        hooks: {
          beforeRequest: [parentHook],
        },
      });
      const extendedApi = baseApi.extend({
        hooks: {
          beforeRequest: [childHook],
        },
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      expect(parentHook).toHaveBeenCalled();
      expect(childHook).toHaveBeenCalled();
    });
  });

  describe('validation disabled', () => {
    it('should skip response validation when validateResponse is false', async () => {
      // Arrange
      mockFetch({ id: 'not-a-number' });
      const UserSchema = v.object({
        id: v.number(),
      });

      // Act
      const result = await valifetch.get('https://api.example.com/users/1', {
        responseSchema: UserSchema,
        validateResponse: false,
      });

      // Assert
      expect(result).toEqual({ id: 'not-a-number' });
    });

    it('should skip body validation when validateRequest is false', async () => {
      // Arrange
      mockFetch({ success: true });
      const BodySchema = v.object({
        name: v.pipe(v.string(), v.minLength(10)),
      });

      // Act
      const result = await valifetch.post('https://api.example.com/users', {
        json: { name: 'Jo' },
        bodySchema: BodySchema,
        validateRequest: false,
      });

      // Assert
      expect(result).toEqual({ success: true });
    });
  });
});
