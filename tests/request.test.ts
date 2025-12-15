import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { buildRequest, mergeOptions } from '../src/core/request';
import { ValifetchError } from '../src/errors/ValifetchError';

describe('core/request', () => {
  describe('mergeOptions', () => {
    it('should merge instance and request headers', () => {
      // Arrange
      const instanceOptions = {
        headers: { Authorization: 'Bearer token' },
      };
      const requestOptions = {
        headers: { 'X-Custom': 'value' },
      };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.headers.get('Authorization')).toBe('Bearer token');
      expect(result.headers.get('X-Custom')).toBe('value');
    });

    it('should merge headers when request headers is Headers instance', () => {
      // Arrange
      const instanceOptions = {
        headers: { Authorization: 'Bearer token' },
      };
      const requestHeaders = new Headers();
      requestHeaders.set('X-Custom', 'value');
      const requestOptions = {
        headers: requestHeaders,
      };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.headers.get('Authorization')).toBe('Bearer token');
      expect(result.headers.get('X-Custom')).toBe('value');
    });

    it('should merge headers when request headers is array of tuples', () => {
      // Arrange
      const instanceOptions = {
        headers: { Authorization: 'Bearer token' },
      };
      const requestOptions = {
        headers: [
          ['X-Custom', 'value'],
          ['X-Another', 'another-value'],
        ] as [string, string][],
      };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.headers.get('Authorization')).toBe('Bearer token');
      expect(result.headers.get('X-Custom')).toBe('value');
      expect(result.headers.get('X-Another')).toBe('another-value');
    });

    it('should override instance headers with request headers', () => {
      // Arrange
      const instanceOptions = {
        headers: { Authorization: 'Bearer old-token' },
      };
      const requestOptions = {
        headers: { Authorization: 'Bearer new-token' },
      };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.headers.get('Authorization')).toBe('Bearer new-token');
    });

    it('should merge hooks from instance and request', () => {
      // Arrange
      const instanceHook1 = () => undefined;
      const instanceHook2 = () => undefined;
      const requestHook = () => undefined;

      const instanceOptions = {
        hooks: {
          beforeRequest: [instanceHook1],
          afterResponse: [instanceHook2],
        },
      };
      const requestOptions = {
        hooks: {
          beforeRequest: [requestHook],
        },
      };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.hooks?.beforeRequest).toEqual([instanceHook1, requestHook]);
      expect(result.hooks?.afterResponse).toEqual([instanceHook2]);
    });

    it('should use request prefixUrl over instance prefixUrl', () => {
      // Arrange
      const instanceOptions = {
        prefixUrl: 'https://old-api.example.com',
      };
      const requestOptions = {
        prefixUrl: 'https://new-api.example.com',
      };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.prefixUrl).toBe('https://new-api.example.com');
    });

    it('should fall back to instance prefixUrl when request has none', () => {
      // Arrange
      const instanceOptions = {
        prefixUrl: 'https://api.example.com',
      };
      const requestOptions = {};

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.prefixUrl).toBe('https://api.example.com');
    });

    it('should use request timeout over instance timeout', () => {
      // Arrange
      const instanceOptions = { timeout: 5000 };
      const requestOptions = { timeout: 10000 };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.timeout).toBe(10000);
    });

    it('should default validateResponse to true', () => {
      // Arrange
      const instanceOptions = {};
      const requestOptions = {};

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.validateResponse).toBe(true);
    });

    it('should respect validateResponse from request', () => {
      // Arrange
      const instanceOptions = { validateResponse: true };
      const requestOptions = { validateResponse: false };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.validateResponse).toBe(false);
    });

    it('should default validateRequest to true', () => {
      // Arrange
      const instanceOptions = {};
      const requestOptions = {};

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.validateRequest).toBe(true);
    });

    it('should default throwHttpErrors to true', () => {
      // Arrange
      const instanceOptions = {};
      const requestOptions = {};

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.throwHttpErrors).toBe(true);
    });

    it('should use request retry over instance retry', () => {
      // Arrange
      const instanceOptions = { retry: 3 };
      const requestOptions = { retry: false as const };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.retry).toBe(false);
    });

    it('should handle empty hooks gracefully', () => {
      // Arrange
      const instanceOptions = {};
      const requestOptions = {};

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert - hooks returns empty object when no hooks provided (memory optimization)
      expect(result.hooks).toEqual({});
      expect(result.hooks?.beforeRequest).toBeUndefined();
      expect(result.hooks?.afterResponse).toBeUndefined();
    });

    it('should use request hooks when instance has no hooks', () => {
      // Arrange
      const requestHook = () => undefined;
      const instanceOptions = {};
      const requestOptions = {
        hooks: {
          beforeRequest: [requestHook],
        },
      };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.hooks?.beforeRequest).toEqual([requestHook]);
    });

    it('should use instance hooks when request has no hooks', () => {
      // Arrange
      const instanceHook = () => undefined;
      const instanceOptions = {
        hooks: {
          afterResponse: [instanceHook],
        },
      };
      const requestOptions = {};

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.hooks?.afterResponse).toEqual([instanceHook]);
    });

    it('should handle partial hooks in both instance and request', () => {
      // Arrange - instance has beforeRequest, request has afterResponse
      const instanceHook = () => undefined;
      const requestHook = () => undefined;
      const instanceOptions = {
        hooks: {
          beforeRequest: [instanceHook],
        },
      };
      const requestOptions = {
        hooks: {
          afterResponse: [requestHook],
        },
      };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.hooks?.beforeRequest).toEqual([instanceHook]);
      expect(result.hooks?.afterResponse).toEqual([requestHook]);
    });

    it('should handle afterParseResponse hooks merge', () => {
      // Arrange
      const instanceHook = () => undefined;
      const requestHook = () => undefined;
      const instanceOptions = {
        hooks: {
          afterParseResponse: [instanceHook],
        },
      };
      const requestOptions = {
        hooks: {
          afterParseResponse: [requestHook],
        },
      };

      // Act
      const result = mergeOptions(instanceOptions, requestOptions as any);

      // Assert
      expect(result.hooks?.afterParseResponse).toEqual([
        instanceHook,
        requestHook,
      ]);
    });
  });

  describe('buildRequest', () => {
    describe('URL building', () => {
      it('should build request with absolute URL', async () => {
        // Arrange
        const url = 'https://api.example.com/users';
        const method = 'GET';

        // Act
        const result = await buildRequest(url, method, {}, {});

        // Assert
        expect(result.request.url).toBe('https://api.example.com/users');
        expect(result.request.method).toBe('GET');
      });

      it('should build request with prefixUrl', async () => {
        // Arrange
        const url = '/users';
        const method = 'GET';
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(url, method, {}, instanceOptions);

        // Assert
        expect(result.request.url).toBe('https://api.example.com/users');
      });

      it('should replace path params', async () => {
        // Arrange
        const url = '/users/:id';
        const method = 'GET';
        const options = { params: { id: 123 } };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(
          url,
          method,
          options as any,
          instanceOptions
        );

        // Assert
        expect(result.request.url).toBe('https://api.example.com/users/123');
      });

      it('should add search params', async () => {
        // Arrange
        const url = '/users';
        const method = 'GET';
        const options = { searchParams: { page: 1, limit: 10 } };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(
          url,
          method,
          options as any,
          instanceOptions
        );

        // Assert
        expect(result.request.url).toContain('page=1');
        expect(result.request.url).toContain('limit=10');
      });
    });

    describe('params validation', () => {
      it('should validate params against schema', async () => {
        // Arrange
        const url = '/users/:id';
        const method = 'GET';
        const paramsSchema = v.object({
          id: v.pipe(v.number(), v.minValue(1)),
        });
        const options = {
          params: { id: 5 },
          paramsSchema,
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(
          url,
          method,
          options as any,
          instanceOptions
        );

        // Assert
        expect(result.request.url).toBe('https://api.example.com/users/5');
      });

      it('should throw ValifetchError for invalid params', async () => {
        // Arrange
        const url = '/users/:id';
        const method = 'GET';
        const paramsSchema = v.object({
          id: v.number(),
        });
        const options = {
          params: { id: 'invalid' },
          paramsSchema,
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act & Assert
        await expect(
          buildRequest(url, method, options as any, instanceOptions)
        ).rejects.toThrow(ValifetchError);
      });

      it('should skip params validation when validateRequest is false', async () => {
        // Arrange
        const url = '/users/:id';
        const method = 'GET';
        const paramsSchema = v.object({
          id: v.number(),
        });
        const options = {
          params: { id: 'string-value' },
          paramsSchema,
          validateRequest: false,
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(
          url,
          method,
          options as any,
          instanceOptions
        );

        // Assert
        expect(result.request.url).toBe(
          'https://api.example.com/users/string-value'
        );
      });
    });

    describe('search params validation', () => {
      it('should validate search params against schema', async () => {
        // Arrange
        const url = '/users';
        const method = 'GET';
        const searchSchema = v.object({
          page: v.number(),
          limit: v.number(),
        });
        const options = {
          searchParams: { page: 1, limit: 10 },
          searchSchema,
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(
          url,
          method,
          options as any,
          instanceOptions
        );

        // Assert
        expect(result.request.url).toContain('page=1');
        expect(result.request.url).toContain('limit=10');
      });

      it('should throw ValifetchError for invalid search params', async () => {
        // Arrange
        const url = '/users';
        const method = 'GET';
        const searchSchema = v.object({
          page: v.number(),
        });
        const options = {
          searchParams: { page: 'one' },
          searchSchema,
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act & Assert
        await expect(
          buildRequest(url, method, options as any, instanceOptions)
        ).rejects.toThrow(ValifetchError);
      });
    });

    describe('JSON body handling', () => {
      it('should set JSON body and Content-Type header', async () => {
        // Arrange
        const url = '/users';
        const method = 'POST';
        const options = {
          json: { name: 'John', email: 'john@example.com' },
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(
          url,
          method,
          options as any,
          instanceOptions
        );

        // Assert
        expect(result.request.headers.get('Content-Type')).toBe(
          'application/json'
        );
        expect(result.request.headers.get('Accept')).toBe('application/json');
        const body = await result.request.text();
        expect(JSON.parse(body)).toEqual({
          name: 'John',
          email: 'john@example.com',
        });
      });

      it('should validate body against schema', async () => {
        // Arrange
        const url = '/users';
        const method = 'POST';
        const bodySchema = v.object({
          name: v.pipe(v.string(), v.minLength(1)),
          email: v.pipe(v.string(), v.email()),
        });
        const options = {
          json: { name: 'John', email: 'john@example.com' },
          bodySchema,
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(
          url,
          method,
          options as any,
          instanceOptions
        );

        // Assert
        const body = await result.request.text();
        expect(JSON.parse(body)).toEqual({
          name: 'John',
          email: 'john@example.com',
        });
      });

      it('should throw ValifetchError for invalid body', async () => {
        // Arrange
        const url = '/users';
        const method = 'POST';
        const bodySchema = v.object({
          email: v.pipe(v.string(), v.email()),
        });
        const options = {
          json: { email: 'not-an-email' },
          bodySchema,
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act & Assert
        await expect(
          buildRequest(url, method, options as any, instanceOptions)
        ).rejects.toThrow(ValifetchError);
      });

      it('should not override existing Content-Type header', async () => {
        // Arrange
        const url = '/users';
        const method = 'POST';
        const options = {
          json: { data: 'test' },
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(
          url,
          method,
          options as any,
          instanceOptions
        );

        // Assert
        expect(result.request.headers.get('Content-Type')).toBe(
          'application/json; charset=utf-8'
        );
      });

      it('should not override existing Accept header', async () => {
        // Arrange
        const url = '/users';
        const method = 'POST';
        const options = {
          json: { data: 'test' },
          headers: { Accept: 'application/json; charset=utf-8' },
        };
        const instanceOptions = { prefixUrl: 'https://api.example.com' };

        // Act
        const result = await buildRequest(
          url,
          method,
          options as any,
          instanceOptions
        );

        // Assert
        expect(result.request.headers.get('Accept')).toBe(
          'application/json; charset=utf-8'
        );
      });
    });

    describe('fetch options', () => {
      it('should pass credentials option', async () => {
        // Arrange
        const url = 'https://api.example.com/users';
        const method = 'GET';
        const options = { credentials: 'include' as const };

        // Act
        const result = await buildRequest(url, method, options as any, {});

        // Assert
        expect(result.request.credentials).toBe('include');
      });

      it('should pass signal option', async () => {
        // Arrange
        const url = 'https://api.example.com/users';
        const method = 'GET';
        const controller = new AbortController();
        const options = { signal: controller.signal };

        // Act
        const result = await buildRequest(url, method, options as any, {});

        // Assert - Request creates its own signal linked to the provided one
        expect(result.request.signal).toBeDefined();
        expect(result.request.signal.aborted).toBe(false);
      });

      it('should pass cache option', async () => {
        // Arrange
        const url = 'https://api.example.com/users';
        const method = 'GET';
        const options = { cache: 'no-store' as const };

        // Act
        const result = await buildRequest(url, method, options as any, {});

        // Assert
        expect(result.request.cache).toBe('no-store');
      });
    });

    describe('normalized options', () => {
      it('should return validateResponse in result', async () => {
        // Arrange
        const url = 'https://api.example.com/users';
        const method = 'GET';
        const options = { validateResponse: false };

        // Act
        const result = await buildRequest(url, method, options as any, {});

        // Assert
        expect(result.validateResponse).toBe(false);
      });

      it('should return throwHttpErrors in result', async () => {
        // Arrange
        const url = 'https://api.example.com/users';
        const method = 'GET';
        const options = { throwHttpErrors: false };

        // Act
        const result = await buildRequest(url, method, options as any, {});

        // Assert
        expect(result.throwHttpErrors).toBe(false);
      });

      it('should return responseSchema in result', async () => {
        // Arrange
        const url = 'https://api.example.com/users';
        const method = 'GET';
        const responseSchema = v.object({ id: v.number() });
        const options = { responseSchema };

        // Act
        const result = await buildRequest(url, method, options as any, {});

        // Assert
        expect(result.responseSchema).toBe(responseSchema);
      });

      it('should include method in normalizedOptions', async () => {
        // Arrange
        const url = 'https://api.example.com/users';
        const method = 'POST';

        // Act
        const result = await buildRequest(url, method, {}, {});

        // Assert
        expect(result.normalizedOptions.method).toBe('POST');
      });
    });
  });
});
