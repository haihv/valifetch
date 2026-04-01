import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      it('should make POST request without options', async () => {
        // Arrange — covers `options ?? EMPTY` false branch
        mockFetch({ id: 1 });

        // Act
        const result = await valifetch.post('https://api.example.com/users');

        // Assert
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('POST');
        expect(result).toEqual({ id: 1 });
      });

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
      it('should make PUT request without options', async () => {
        // Arrange — covers `options ?? EMPTY` false branch
        mockFetch({ id: 1 });

        // Act
        const result = await valifetch.put('https://api.example.com/users/1');

        // Assert
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('PUT');
        expect(result).toEqual({ id: 1 });
      });

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
      it('should make PATCH request without options', async () => {
        // Arrange — covers `options ?? EMPTY` false branch
        mockFetch({ id: 1 });

        // Act
        const result = await valifetch.patch('https://api.example.com/users/1');

        // Assert
        const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
        expect(request.method).toBe('PATCH');
        expect(result).toEqual({ id: 1 });
      });

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

      it('should use default retry limit of 2 when limit is not specified', async () => {
        // Arrange — covers `retryOptions.limit ?? 2` false branch
        let callCount = 0;
        fetchSpy.mockImplementation(() => {
          callCount++;
          if (callCount <= 2) return Promise.reject(new Error('Network error'));
          return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
        });

        // Act — retry with no limit specified, defaults to 2
        const result = await valifetch.get('https://api.example.com/users', {
          retry: { methods: ['GET'], delay: () => 1 },
        });

        // Assert
        expect(callCount).toBe(3); // 1 initial + 2 retries
        expect(result).toEqual({ ok: true });
      }, 10000);

      it('should use fallback message when error has no message', async () => {
        // Arrange — covers `error.message || 'Network request failed'` false branch
        mockFetchError(new Error(''));

        // Act & Assert
        try {
          await valifetch.get('https://api.example.com/users', {
            retry: false,
          });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect((error as ValifetchError).message).toBe(
            'Network request failed'
          );
        }
      });

      it('should rethrow non-Error objects', async () => {
        // Arrange
        fetchSpy.mockRejectedValue('string error');

        // Act & Assert
        await expect(
          valifetch.get('https://api.example.com/users', { retry: false })
        ).rejects.toBe('string error');
      });

      it('should throw NETWORK_ERROR after all retry attempts exhausted', async () => {
        fetchSpy.mockRejectedValue(new Error('Network failure'));

        try {
          await valifetch.get('https://api.example.com/users', {
            retry: {
              limit: 2,
              methods: ['GET'],
              statusCodes: [500],
              delay: () => 1,
            },
          });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect((error as ValifetchError).code).toBe('NETWORK_ERROR');
          expect((error as ValifetchError).message).toBe('Network failure');
          expect((error as ValifetchError).cause).toBeInstanceOf(Error);
        }

        expect(fetchSpy).toHaveBeenCalledTimes(3);
      }, 10000);
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

    describe('afterParseResponse', () => {
      it('should call afterParseResponse hook with parsed data', async () => {
        // Arrange
        mockFetch({ id: 1, name: 'John' });
        const afterParseHook = vi.fn((data) => data);
        const api = valifetch.create({
          prefixUrl: 'https://api.example.com',
          hooks: {
            afterParseResponse: [afterParseHook],
          },
        });

        // Act
        await api.get('/users/1');

        // Assert
        expect(afterParseHook).toHaveBeenCalledWith(
          { id: 1, name: 'John' },
          expect.any(Response),
          expect.any(Request)
        );
      });

      it('should transform data with afterParseResponse hook', async () => {
        // Arrange
        mockFetch({ data: { id: 1 }, meta: { total: 1 } });
        const unwrapHook = (data: any) => data.data;
        const api = valifetch.create({
          prefixUrl: 'https://api.example.com',
          hooks: {
            afterParseResponse: [unwrapHook],
          },
        });

        // Act
        const result = await api.get('/users/1');

        // Assert
        expect(result).toEqual({ id: 1 });
      });

      it('should chain multiple afterParseResponse hooks', async () => {
        // Arrange
        mockFetch({ value: 1 });
        const hook1 = (data: any) => ({ ...data, step1: true });
        const hook2 = (data: any) => ({ ...data, step2: true });
        const api = valifetch.create({
          prefixUrl: 'https://api.example.com',
          hooks: {
            afterParseResponse: [hook1, hook2],
          },
        });

        // Act
        const result = await api.get('/test');

        // Assert
        expect(result).toEqual({ value: 1, step1: true, step2: true });
      });

      it('should merge afterParseResponse hooks when extending instance', async () => {
        // Arrange
        mockFetch({ value: 1 });
        const hook1 = (data: any) => ({ ...data, fromBase: true });
        const hook2 = (data: any) => ({ ...data, fromExtended: true });
        const baseApi = valifetch.create({
          prefixUrl: 'https://api.example.com',
          hooks: {
            afterParseResponse: [hook1],
          },
        });
        const extendedApi = baseApi.extend({
          hooks: {
            afterParseResponse: [hook2],
          },
        });

        // Act
        const result = await extendedApi.get('/test');

        // Assert
        expect(result).toEqual({
          value: 1,
          fromBase: true,
          fromExtended: true,
        });
      });
    });
  });

  describe('create instance', () => {
    it('should create instance without arguments', async () => {
      // Arrange — covers `newOptions ?? EMPTY` false branch
      mockFetch({ id: 1 });
      const api = valifetch.create();

      // Act
      const result = await api.get('https://api.example.com/users/1');

      // Assert
      expect(result).toEqual({ id: 1 });
    });

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

    it('should extend instance with Headers instance', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const parentHeaders = new Headers();
      parentHeaders.set('Authorization', 'Bearer token123');
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        headers: parentHeaders,
      });
      const childHeaders = new Headers();
      childHeaders.set('X-Custom', 'value');
      const extendedApi = baseApi.extend({
        headers: childHeaders,
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.headers.get('Authorization')).toBe('Bearer token123');
      expect(request.headers.get('X-Custom')).toBe('value');
    });

    it('should extend instance with array headers', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        headers: [['Authorization', 'Bearer token123']] as [string, string][],
      });
      const extendedApi = baseApi.extend({
        headers: [['X-Custom', 'value']] as [string, string][],
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

    it('should extend with validateResponse option', async () => {
      // Arrange
      mockFetch({ id: 'not-a-number' });
      const UserSchema = v.object({
        id: v.number(),
      });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        validateResponse: true,
      });
      const extendedApi = baseApi.extend({
        validateResponse: false,
      });

      // Act
      const result = await extendedApi.get('/users/1', {
        responseSchema: UserSchema,
      });

      // Assert
      expect(result).toEqual({ id: 'not-a-number' });
    });

    it('should extend with validateRequest option', async () => {
      // Arrange
      mockFetch({ success: true });
      const BodySchema = v.object({
        name: v.pipe(v.string(), v.minLength(10)),
      });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        validateRequest: true,
      });
      const extendedApi = baseApi.extend({
        validateRequest: false,
      });

      // Act
      const result = await extendedApi.post('/users', {
        json: { name: 'Jo' },
        bodySchema: BodySchema,
      });

      // Assert
      expect(result).toEqual({ success: true });
    });

    it('should extend with throwHttpErrors option', async () => {
      // Arrange
      mockFetch({ error: 'Not Found' }, 404);
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        throwHttpErrors: true,
      });
      const extendedApi = baseApi.extend({
        throwHttpErrors: false,
      });

      // Act
      const result = await extendedApi.get('/users/999');

      // Assert
      expect(result).toEqual({ error: 'Not Found' });
    });

    it('should extend with referrerPolicy option', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        referrerPolicy: 'no-referrer',
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.referrerPolicy).toBe('no-referrer');
    });

    it('should extend with credentials option', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        credentials: 'include',
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.credentials).toBe('include');
    });

    it('should extend with cache option', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        cache: 'no-store',
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.cache).toBe('no-store');
    });

    it('should extend with redirect option', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        redirect: 'manual',
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.redirect).toBe('manual');
    });

    it('should extend with integrity option', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        integrity: 'sha256-abc123',
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.integrity).toBe('sha256-abc123');
    });

    it('should extend with keepalive option', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        keepalive: true,
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.keepalive).toBe(true);
    });

    it('should extend with mode option', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        mode: 'cors',
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.mode).toBe('cors');
    });

    it('should extend with retry option', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        retry: 3,
      });
      const extendedApi = baseApi.extend({
        retry: false,
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should extend with referrer option', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        referrer: 'https://referrer.example.com',
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.referrer).toBe('https://referrer.example.com/');
    });

    it('should inherit parent hooks when child has no hooks', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const parentHook = vi.fn();
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        hooks: { beforeRequest: [parentHook] },
      });
      const extendedApi = baseApi.extend({ timeout: 5000 });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      expect(parentHook).toHaveBeenCalled();
    });

    it('should inherit parent headers when child adds no headers', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        headers: { Authorization: 'Bearer token' },
      });
      const extendedApi = baseApi.extend({ timeout: 5000 });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.headers.get('Authorization')).toBe('Bearer token');
    });

    it('should extend with a different prefixUrl', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        prefixUrl: 'https://v2.example.com',
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.url).toContain('v2.example.com');
    });

    it('should add hooks when base instance has none', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const childHook = vi.fn();
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
      });
      const extendedApi = baseApi.extend({
        hooks: { beforeRequest: [childHook] },
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      expect(childHook).toHaveBeenCalled();
    });

    it('should merge partial hooks — parent afterResponse, child beforeRequest', async () => {
      // Arrange — covers concatArrays(undefined, [hook]) branch
      mockFetch({ id: 1 });
      const afterResponseHook = vi
        .fn()
        .mockImplementation((req, opts, res) => res);
      const beforeRequestHook = vi.fn();
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        hooks: { afterResponse: [afterResponseHook] },
      });
      const extendedApi = baseApi.extend({
        hooks: { beforeRequest: [beforeRequestHook] },
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      expect(afterResponseHook).toHaveBeenCalled();
      expect(beforeRequestHook).toHaveBeenCalled();
    });

    it('should merge partial hooks — parent beforeRequest, child afterResponse', async () => {
      // Arrange — covers concatArrays([hook], undefined) branch
      mockFetch({ id: 1 });
      const beforeRequestHook = vi.fn();
      const afterResponseHook = vi
        .fn()
        .mockImplementation((req, opts, res) => res);
      const baseApi = valifetch.create({
        prefixUrl: 'https://api.example.com',
        hooks: { beforeRequest: [beforeRequestHook] },
      });
      const extendedApi = baseApi.extend({
        hooks: { afterResponse: [afterResponseHook] },
      });

      // Act
      await extendedApi.get('/users/1');

      // Assert
      expect(beforeRequestHook).toHaveBeenCalled();
      expect(afterResponseHook).toHaveBeenCalled();
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

  describe('callable wrapper', () => {
    it('should make GET request when called as function', async () => {
      // Arrange
      mockFetch({ id: 1, name: 'John' });
      const api = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .callable();

      // Act
      const result = await api('/users/1');

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.method).toBe('GET');
      expect(request.url).toBe('https://api.example.com/users/1');
      expect(result).toEqual({ id: 1, name: 'John' });
    });

    it('should make POST request with method option', async () => {
      // Arrange
      mockFetch({ id: 1, name: 'John' });
      const api = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .callable();

      // Act
      const result = await api('/users', {
        method: 'POST',
        json: { name: 'John' },
      });

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.method).toBe('POST');
      expect(result).toEqual({ id: 1, name: 'John' });
    });

    it('should have HTTP method shortcuts', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const api = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .callable();

      // Act
      await api.get('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.method).toBe('GET');
    });

    it('should return callable instance from create()', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch.callable();
      const api = baseApi.create({ prefixUrl: 'https://api.example.com' });

      // Act
      const result = await api('/users/1');

      // Assert
      expect(result).toEqual({ id: 1 });
      expect(typeof api).toBe('function');
    });

    it('should return callable instance from extend()', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .callable();
      const api = baseApi.extend({ headers: { 'X-Custom': 'value' } });

      // Act
      const result = await api('/users/1');

      // Assert
      expect(result).toEqual({ id: 1 });
      expect(typeof api).toBe('function');
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.headers.get('X-Custom')).toBe('value');
    });

    it('should extend with function', async () => {
      // Arrange
      mockFetch({ id: 1 });
      const baseApi = valifetch
        .create({ prefixUrl: 'https://api.example.com' })
        .callable();
      const api = baseApi.extend((parent) => ({
        ...parent,
        headers: { 'X-Dynamic': 'dynamic-value' },
      }));

      // Act
      await api('/users/1');

      // Assert
      const [request] = fetchSpy.mock.calls[0] as [Request, RequestInit];
      expect(request.headers.get('X-Dynamic')).toBe('dynamic-value');
    });
  });
});
