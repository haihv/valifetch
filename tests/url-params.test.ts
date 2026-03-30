import { describe, expect, it } from 'vitest';
import {
  extractParamNames,
  hasPathParams,
  replacePathParams,
} from '../src/url/params';

describe('url/params', () => {
  describe('replacePathParams', () => {
    describe('basic replacement', () => {
      it('should replace a single param', () => {
        // Arrange
        const path = '/users/:id';
        const params = { id: 123 };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/users/123');
      });

      it('should replace multiple params', () => {
        // Arrange
        const path = '/users/:userId/posts/:postId';
        const params = { userId: 1, postId: 42 };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/users/1/posts/42');
      });

      it('should handle string values', () => {
        // Arrange
        const path = '/users/:name';
        const params = { name: 'john' };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/users/john');
      });

      it('should return path unchanged when no params in path', () => {
        // Arrange
        const path = '/users/list';
        const params = { id: 123 };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/users/list');
      });
    });

    describe('URL encoding', () => {
      it('should encode special characters', () => {
        // Arrange
        const path = '/search/:query';
        const params = { query: 'hello world' };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/search/hello%20world');
      });

      it('should encode slashes in values', () => {
        // Arrange
        const path = '/files/:path';
        const params = { path: 'dir/file.txt' };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/files/dir%2Ffile.txt');
      });

      it('should encode unicode characters', () => {
        // Arrange
        const path = '/users/:name';
        const params = { name: '日本語' };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/users/%E6%97%A5%E6%9C%AC%E8%AA%9E');
      });
    });

    describe('param name patterns', () => {
      it('should handle underscores in param names', () => {
        // Arrange
        const path = '/api/:user_id/data/:data_type';
        const params = { user_id: 1, data_type: 'json' };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/api/1/data/json');
      });

      it('should handle numbers in param names', () => {
        // Arrange
        const path = '/api/:param1/:param2';
        const params = { param1: 'a', param2: 'b' };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/api/a/b');
      });

      it('should handle single character param names', () => {
        // Arrange
        const path = '/api/:a/:b/:c';
        const params = { a: 1, b: 2, c: 3 };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/api/1/2/3');
      });
    });

    describe('error handling', () => {
      it('should throw error for missing required param', () => {
        // Arrange
        const path = '/users/:id';
        const params = {};

        // Act & Assert
        expect(() => replacePathParams(path, params)).toThrow(
          'Missing required path parameter: id'
        );
      });

      it('should throw error for null param value', () => {
        // Arrange
        const path = '/users/:id';
        const params = { id: null as unknown as string };

        // Act & Assert
        expect(() => replacePathParams(path, params)).toThrow(
          'Path parameter "id" cannot be null or undefined'
        );
      });

      it('should throw error for undefined param value', () => {
        // Arrange
        const path = '/users/:id';
        const params = { id: undefined as unknown as string };

        // Act & Assert
        expect(() => replacePathParams(path, params)).toThrow(
          'Path parameter "id" cannot be null or undefined'
        );
      });
    });

    describe('edge cases', () => {
      it('should handle empty path', () => {
        // Arrange
        const path = '';
        const params = {};

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('');
      });

      it('should preserve colon when followed by invalid param character', () => {
        // Arrange - colon followed by special char (not valid param char)
        const path = '/protocol://example.com';
        const params = {};

        // Act
        const result = replacePathParams(path, params);

        // Assert - colon is preserved as-is
        expect(result).toBe('/protocol://example.com');
      });

      it('should preserve colon at end of path', () => {
        // Arrange - colon at end with no following character
        const path = '/protocol:';
        const params = {};

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/protocol:');
      });

      it('should handle param at the end', () => {
        // Arrange
        const path = '/api/users/:id';
        const params = { id: 99 };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/api/users/99');
      });

      it('should handle param at the start', () => {
        // Arrange
        const path = ':version/api';
        const params = { version: 'v1' };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('v1/api');
      });

      it('should convert number 0 correctly', () => {
        // Arrange
        const path = '/items/:index';
        const params = { index: 0 };

        // Act
        const result = replacePathParams(path, params);

        // Assert
        expect(result).toBe('/items/0');
      });

      it('should handle param followed by dot', () => {
        const path = '/files/:name.json';
        const params = { name: 'data' };

        const result = replacePathParams(path, params);

        expect(result).toBe('/files/data.json');
      });

      it('should handle param followed by question mark', () => {
        const path = '/search/:query?limit=10';
        const params = { query: 'test' };

        const result = replacePathParams(path, params);

        expect(result).toBe('/search/test?limit=10');
      });

      it('should handle consecutive colons - second colon creates param', () => {
        const path = '/protocol::port';
        const params = { port: '8080' };

        const result = replacePathParams(path, params);

        expect(result).toBe('/protocol:8080');
      });

      it('should handle empty string value', () => {
        const path = '/users/:id';
        const params = { id: '' };

        const result = replacePathParams(path, params);

        expect(result).toBe('/users/');
      });

      it('should handle boolean value', () => {
        const path = '/api/:active';
        const params = { active: true as unknown as string };

        const result = replacePathParams(path, params);

        expect(result).toBe('/api/true');
      });

      it('should handle negative numbers', () => {
        const path = '/items/:offset';
        const params = { offset: -10 };

        const result = replacePathParams(path, params);

        expect(result).toBe('/items/-10');
      });

      it('should handle float numbers', () => {
        const path = '/products/:price';
        const params = { price: 99.99 };

        const result = replacePathParams(path, params);

        expect(result).toBe('/products/99.99');
      });

      it('should handle uppercase param names', () => {
        const path = '/api/:UserID/:PostID';
        const params = { UserID: 1, PostID: 2 };

        const result = replacePathParams(path, params);

        expect(result).toBe('/api/1/2');
      });

      it('should handle very large numbers', () => {
        const path = '/items/:id';
        const params = { id: Number.MAX_SAFE_INTEGER };

        const result = replacePathParams(path, params);

        expect(result).toBe('/items/9007199254740991');
      });
    });
  });

  describe('extractParamNames', () => {
    it('should extract single param name', () => {
      // Arrange
      const path = '/users/:id';

      // Act
      const result = extractParamNames(path);

      // Assert
      expect(result).toEqual(['id']);
    });

    it('should extract multiple param names', () => {
      // Arrange
      const path = '/users/:userId/posts/:postId/comments/:commentId';

      // Act
      const result = extractParamNames(path);

      // Assert
      expect(result).toEqual(['userId', 'postId', 'commentId']);
    });

    it('should return empty array when no params', () => {
      // Arrange
      const path = '/users/list';

      // Act
      const result = extractParamNames(path);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle underscores in names', () => {
      // Arrange
      const path = '/api/:user_id/:post_id';

      // Act
      const result = extractParamNames(path);

      // Assert
      expect(result).toEqual(['user_id', 'post_id']);
    });

    it('should handle empty path', () => {
      // Arrange
      const path = '';

      // Act
      const result = extractParamNames(path);

      // Assert
      expect(result).toEqual([]);
    });

    it('should extract params followed by special chars', () => {
      const path = '/files/:name.json?filter=:type';

      const result = extractParamNames(path);

      expect(result).toEqual(['name', 'type']);
    });

    it('should extract from consecutive colons - second colon creates param', () => {
      const path = '/protocol::port';

      const result = extractParamNames(path);

      expect(result).toEqual(['port']);
    });

    it('should extract uppercase param names', () => {
      const path = '/api/:UserID/:PostID';

      const result = extractParamNames(path);

      expect(result).toEqual(['UserID', 'PostID']);
    });

    it('should extract pattern even when starting with digit', () => {
      // hasPathParams returns false for this, but extractParamNames still extracts it
      const path = '/users/:123invalid';

      const result = extractParamNames(path);

      expect(result).toEqual(['123invalid']);
    });

    it('should properly exit loop when no more colons after param', () => {
      const path = '/api/:version/users/list/all/data';

      const result = extractParamNames(path);

      expect(result).toEqual(['version']);
    });
  });

  describe('hasPathParams', () => {
    it('should return true when path has params', () => {
      // Arrange
      const path = '/users/:id';

      // Act
      const result = hasPathParams(path);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when path has no params', () => {
      // Arrange
      const path = '/users/list';

      // Act
      const result = hasPathParams(path);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for multiple params', () => {
      // Arrange
      const path = '/users/:id/posts/:postId';

      // Act
      const result = hasPathParams(path);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for empty path', () => {
      // Arrange
      const path = '';

      // Act
      const result = hasPathParams(path);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for colon without valid param name', () => {
      // Arrange
      const path = '/users/:123invalid';

      // Act
      const result = hasPathParams(path);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for param with underscore', () => {
      const path = '/api/:user_id';

      const result = hasPathParams(path);

      expect(result).toBe(true);
    });

    it('should return true for uppercase param', () => {
      const path = '/api/:UserID';

      const result = hasPathParams(path);

      expect(result).toBe(true);
    });

    it('should return false for consecutive colons', () => {
      const path = '/protocol::port';

      const result = hasPathParams(path);

      expect(result).toBe(false);
    });

    it('should return true for param followed by dot', () => {
      const path = '/files/:name.json';

      const result = hasPathParams(path);

      expect(result).toBe(true);
    });

    it('should return false for colon in protocol', () => {
      const path = 'https://example.com';

      const result = hasPathParams(path);

      expect(result).toBe(false);
    });
  });
});
