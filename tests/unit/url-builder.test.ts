import { describe, expect, it } from 'vitest';
import { buildUrl, mergeSearchParams } from '../../src/url/builder';

describe('url/builder', () => {
  describe('buildUrl', () => {
    describe('basic URL building', () => {
      it('should build URL from absolute path', () => {
        // Arrange
        const options = { path: 'https://api.example.com/users' };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe('https://api.example.com/users');
      });

      it('should build URL with prefixUrl', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe('https://api.example.com/users');
      });

      it('should handle prefixUrl with trailing slash', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com/',
          path: '/users',
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe('https://api.example.com/users');
      });

      it('should handle path without leading slash', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: 'users',
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe('https://api.example.com/users');
      });

      it('should handle both prefixUrl trailing slash and path without leading slash', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com/',
          path: 'users',
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe('https://api.example.com/users');
      });
    });

    describe('path parameters', () => {
      it('should replace path params', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users/:id',
          params: { id: 123 },
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe('https://api.example.com/users/123');
      });

      it('should replace multiple path params', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users/:userId/posts/:postId',
          params: { userId: 1, postId: 42 },
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe(
          'https://api.example.com/users/1/posts/42'
        );
      });

      it('should not modify path when params is undefined', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users/:id',
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe('https://api.example.com/users/:id');
      });
    });

    describe('search parameters - string format', () => {
      it('should append search params from string', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: 'page=1&limit=10',
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe(
          'https://api.example.com/users?page=1&limit=10'
        );
      });

      it('should handle search params string with special characters', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/search',
          searchParams: 'q=hello+world',
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('q')).toBe('hello world');
      });
    });

    describe('search parameters - URLSearchParams format', () => {
      it('should append search params from URLSearchParams', () => {
        // Arrange
        const params = new URLSearchParams();
        params.append('page', '1');
        params.append('limit', '10');

        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: params,
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('page')).toBe('1');
        expect(result.searchParams.get('limit')).toBe('10');
      });

      it('should handle URLSearchParams with multiple values for same key', () => {
        // Arrange
        const params = new URLSearchParams();
        params.append('tag', 'javascript');
        params.append('tag', 'typescript');

        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/posts',
          searchParams: params,
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.getAll('tag')).toEqual([
          'javascript',
          'typescript',
        ]);
      });
    });

    describe('search parameters - array format', () => {
      it('should append search params from array of tuples', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: [
            ['page', 1],
            ['limit', 10],
          ] as [string, string | number][],
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('page')).toBe('1');
        expect(result.searchParams.get('limit')).toBe('10');
      });

      it('should skip null values in array', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: [
            ['page', 1],
            ['filter', null],
          ] as [string, string | number | null][],
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('page')).toBe('1');
        expect(result.searchParams.has('filter')).toBe(false);
      });

      it('should skip undefined values in array', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: [
            ['page', 1],
            ['filter', undefined],
          ] as [string, string | number | undefined][],
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('page')).toBe('1');
        expect(result.searchParams.has('filter')).toBe(false);
      });
    });

    describe('search parameters - object format', () => {
      it('should append search params from object', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: { page: 1, limit: 10 },
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('page')).toBe('1');
        expect(result.searchParams.get('limit')).toBe('10');
      });

      it('should skip null values in object', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: { page: 1, filter: null },
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('page')).toBe('1');
        expect(result.searchParams.has('filter')).toBe(false);
      });

      it('should skip undefined values in object', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: { page: 1, filter: undefined },
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('page')).toBe('1');
        expect(result.searchParams.has('filter')).toBe(false);
      });

      it('should convert boolean values to string', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: { active: true, deleted: false },
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('active')).toBe('true');
        expect(result.searchParams.get('deleted')).toBe('false');
      });
    });

    describe('combined path params and search params', () => {
      it('should handle both path params and search params', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users/:id/posts',
          params: { id: 123 },
          searchParams: { page: 1 },
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe(
          'https://api.example.com/users/123/posts?page=1'
        );
      });
    });

    describe('edge cases', () => {
      it('should throw error for invalid URL without prefixUrl', () => {
        // Arrange
        const options = { path: 'not-a-valid-url' };

        // Act & Assert
        expect(() => buildUrl(options)).toThrow();
      });

      it('should handle empty searchParams object', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/users',
          searchParams: {},
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.toString()).toBe('https://api.example.com/users');
      });

      it('should handle numeric search param values', () => {
        // Arrange
        const options = {
          prefixUrl: 'https://api.example.com',
          path: '/items',
          searchParams: { count: 42 },
        };

        // Act
        const result = buildUrl(options);

        // Assert
        expect(result.searchParams.get('count')).toBe('42');
      });
    });
  });

  describe('mergeSearchParams', () => {
    it('should return requestParams when instanceParams is undefined', () => {
      const result = mergeSearchParams(undefined, { a: 1 });
      expect(result).toEqual({ a: 1 });
    });

    it('should return instanceParams when requestParams is undefined', () => {
      const result = mergeSearchParams({ a: 1 }, undefined);
      expect(result).toEqual({ a: 1 });
    });

    it('should return undefined when neither side has params', () => {
      const result = mergeSearchParams(undefined, undefined);
      expect(result).toBeUndefined();
    });

    it('should let request keys override instance defaults', () => {
      const merged = mergeSearchParams(
        { a: 1, b: 2 },
        { a: 'override' }
      ) as URLSearchParams;
      expect(merged.get('a')).toBe('override');
      expect(merged.get('b')).toBe('2');
    });

    it('should delete an instance default when the request key is explicitly undefined', () => {
      const merged = mergeSearchParams(
        { a: 1, b: 2 },
        { a: undefined }
      ) as URLSearchParams;
      expect(merged.has('a')).toBe(false);
      expect(merged.get('b')).toBe('2');
    });

    it('should delete an instance default when the request key is explicitly null', () => {
      const merged = mergeSearchParams(
        { a: 1, b: 2 },
        { a: null }
      ) as URLSearchParams;
      expect(merged.has('a')).toBe(false);
      expect(merged.get('b')).toBe('2');
    });

    it('should delete an instance default via a tuple array with an undefined value', () => {
      const merged = mergeSearchParams({ a: 1, b: 2, c: 3 }, [
        ['a', undefined],
        ['c', 'override'],
      ] as [string, string | number | undefined][]) as URLSearchParams;
      expect(merged.has('a')).toBe(false);
      expect(merged.get('b')).toBe('2');
      expect(merged.get('c')).toBe('override');
    });

    it('should delete an instance default via a tuple array with a null value', () => {
      const merged = mergeSearchParams({ a: 1, b: 2 }, [['a', null]] as [
        string,
        string | number | null,
      ][]) as URLSearchParams;
      expect(merged.has('a')).toBe(false);
      expect(merged.get('b')).toBe('2');
    });

    it('should override with a string requestParams without treating it as nullish', () => {
      const merged = mergeSearchParams(
        { a: 1, b: 2 },
        'a=override'
      ) as URLSearchParams;
      expect(merged.get('a')).toBe('override');
      expect(merged.get('b')).toBe('2');
    });

    it('should override with a URLSearchParams requestParams without treating it as nullish', () => {
      const requestParams = new URLSearchParams();
      requestParams.append('a', 'override');
      const merged = mergeSearchParams(
        { a: 1, b: 2 },
        requestParams
      ) as URLSearchParams;
      expect(merged.get('a')).toBe('override');
      expect(merged.get('b')).toBe('2');
    });
  });
});
