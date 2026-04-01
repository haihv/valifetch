import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateRetryDelay,
  DEFAULT_RETRY_OPTIONS,
  normalizeRetryOptions,
  shouldRetry,
  sleep,
} from '../../src/core/retry';

describe('core/retry', () => {
  describe('DEFAULT_RETRY_OPTIONS', () => {
    it('should have limit of 2', () => {
      expect(DEFAULT_RETRY_OPTIONS.limit).toBe(2);
    });

    it('should include GET, PUT, HEAD, DELETE, OPTIONS methods', () => {
      expect(DEFAULT_RETRY_OPTIONS.methods).toContain('GET');
      expect(DEFAULT_RETRY_OPTIONS.methods).toContain('PUT');
      expect(DEFAULT_RETRY_OPTIONS.methods).toContain('HEAD');
      expect(DEFAULT_RETRY_OPTIONS.methods).toContain('DELETE');
      expect(DEFAULT_RETRY_OPTIONS.methods).toContain('OPTIONS');
    });

    it('should not include POST method by default', () => {
      expect(DEFAULT_RETRY_OPTIONS.methods).not.toContain('POST');
    });

    it('should include retryable status codes', () => {
      expect(DEFAULT_RETRY_OPTIONS.statusCodes).toContain(408); // Request Timeout
      expect(DEFAULT_RETRY_OPTIONS.statusCodes).toContain(413); // Payload Too Large
      expect(DEFAULT_RETRY_OPTIONS.statusCodes).toContain(429); // Too Many Requests
      expect(DEFAULT_RETRY_OPTIONS.statusCodes).toContain(500); // Internal Server Error
      expect(DEFAULT_RETRY_OPTIONS.statusCodes).toContain(502); // Bad Gateway
      expect(DEFAULT_RETRY_OPTIONS.statusCodes).toContain(503); // Service Unavailable
      expect(DEFAULT_RETRY_OPTIONS.statusCodes).toContain(504); // Gateway Timeout
    });

    it('should have exponential backoff delay function', () => {
      // Mock Math.random for predictable jitter
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const delay0 = DEFAULT_RETRY_OPTIONS.delay(0);
      const delay1 = DEFAULT_RETRY_OPTIONS.delay(1);
      const delay2 = DEFAULT_RETRY_OPTIONS.delay(2);

      // Base delays: 0.3s, 0.6s, 1.2s with 10% jitter (0.5 * 0.2 * base)
      expect(delay0).toBeGreaterThan(300);
      expect(delay0).toBeLessThan(400);
      expect(delay1).toBeGreaterThan(600);
      expect(delay1).toBeLessThan(800);
      expect(delay2).toBeGreaterThan(1200);
      expect(delay2).toBeLessThan(1600);

      mockRandom.mockRestore();
    });

    it('should cap delay at 30 seconds', () => {
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0);

      // At attempt 10, base would be 0.3 * 2^10 = 307.2s, but should be capped at 30s
      const delay = DEFAULT_RETRY_OPTIONS.delay(10);
      expect(delay).toBe(30000);

      mockRandom.mockRestore();
    });
  });

  describe('normalizeRetryOptions', () => {
    it('should return false when retry is false', () => {
      // Arrange & Act
      const result = normalizeRetryOptions(false);

      // Assert
      expect(result).toBe(false);
    });

    it('should return default options when retry is undefined', () => {
      // Arrange & Act
      const result = normalizeRetryOptions(undefined);

      // Assert
      expect(result).not.toBe(false);
      expect((result as any).limit).toBe(DEFAULT_RETRY_OPTIONS.limit);
      expect((result as any).methods).toEqual(DEFAULT_RETRY_OPTIONS.methods);
      expect((result as any).statusCodes).toEqual(
        DEFAULT_RETRY_OPTIONS.statusCodes
      );
    });

    it('should set limit when retry is a number', () => {
      // Arrange & Act
      const result = normalizeRetryOptions(5);

      // Assert
      expect(result).not.toBe(false);
      expect((result as any).limit).toBe(5);
      expect((result as any).methods).toEqual(DEFAULT_RETRY_OPTIONS.methods);
    });

    it('should merge custom options with defaults', () => {
      // Arrange
      const customOptions = {
        limit: 10,
        methods: ['GET', 'POST'] as const,
      };

      // Act
      const result = normalizeRetryOptions(customOptions as any);

      // Assert
      expect(result).not.toBe(false);
      expect((result as any).limit).toBe(10);
      expect((result as any).methods).toEqual(['GET', 'POST']);
      expect((result as any).statusCodes).toEqual(
        DEFAULT_RETRY_OPTIONS.statusCodes
      );
    });

    it('should allow custom delay function', () => {
      // Arrange
      const customDelay = (attempt: number) => attempt * 100;
      const customOptions = { delay: customDelay };

      // Act
      const result = normalizeRetryOptions(customOptions);

      // Assert
      expect(result).not.toBe(false);
      expect((result as any).delay).toBe(customDelay);
    });

    it('should allow custom status codes', () => {
      // Arrange
      const customOptions = { statusCodes: [500, 502] };

      // Act
      const result = normalizeRetryOptions(customOptions);

      // Assert
      expect(result).not.toBe(false);
      expect((result as any).statusCodes).toEqual([500, 502]);
    });
  });

  describe('shouldRetry', () => {
    const baseOptions = { ...DEFAULT_RETRY_OPTIONS };

    describe('attempt limit checks', () => {
      it('should return false when attempt count exceeds limit', () => {
        // Arrange
        const options = { ...baseOptions, limit: 2 };

        // Act & Assert
        expect(shouldRetry('GET', 500, 2, options)).toBe(false);
        expect(shouldRetry('GET', 500, 3, options)).toBe(false);
      });

      it('should return true when attempt count is below limit', () => {
        // Arrange
        const options = { ...baseOptions, limit: 3 };

        // Act & Assert
        expect(shouldRetry('GET', 500, 0, options)).toBe(true);
        expect(shouldRetry('GET', 500, 1, options)).toBe(true);
        expect(shouldRetry('GET', 500, 2, options)).toBe(true);
      });

      it('should use default limit when not specified', () => {
        // Arrange
        const options = { methods: ['GET'], statusCodes: [500] } as any;

        // Act & Assert
        expect(shouldRetry('GET', 500, 0, options)).toBe(true);
        expect(shouldRetry('GET', 500, 2, options)).toBe(false);
      });
    });

    describe('method checks', () => {
      it('should return true for retryable methods', () => {
        // Arrange
        const options = baseOptions;

        // Act & Assert
        expect(shouldRetry('GET', 500, 0, options)).toBe(true);
        expect(shouldRetry('PUT', 500, 0, options)).toBe(true);
        expect(shouldRetry('HEAD', 500, 0, options)).toBe(true);
        expect(shouldRetry('DELETE', 500, 0, options)).toBe(true);
        expect(shouldRetry('OPTIONS', 500, 0, options)).toBe(true);
      });

      it('should return false for non-retryable methods', () => {
        // Arrange
        const options = baseOptions;

        // Act & Assert
        expect(shouldRetry('POST', 500, 0, options)).toBe(false);
        expect(shouldRetry('PATCH', 500, 0, options)).toBe(false);
      });

      it('should respect custom methods list', () => {
        // Arrange
        const options = { ...baseOptions, methods: ['POST'] as const };

        // Act & Assert
        expect(shouldRetry('POST', 500, 0, options as any)).toBe(true);
        expect(shouldRetry('GET', 500, 0, options as any)).toBe(false);
      });

      it('should use default methods when not specified', () => {
        // Arrange
        const options = { limit: 2, statusCodes: [500] } as any;

        // Act & Assert
        expect(shouldRetry('GET', 500, 0, options)).toBe(true);
        expect(shouldRetry('POST', 500, 0, options)).toBe(false);
      });
    });

    describe('status code checks', () => {
      it('should return true for retryable status codes', () => {
        // Arrange
        const options = baseOptions;

        // Act & Assert
        expect(shouldRetry('GET', 408, 0, options)).toBe(true);
        expect(shouldRetry('GET', 429, 0, options)).toBe(true);
        expect(shouldRetry('GET', 500, 0, options)).toBe(true);
        expect(shouldRetry('GET', 502, 0, options)).toBe(true);
        expect(shouldRetry('GET', 503, 0, options)).toBe(true);
        expect(shouldRetry('GET', 504, 0, options)).toBe(true);
      });

      it('should return false for non-retryable status codes', () => {
        // Arrange
        const options = baseOptions;

        // Act & Assert
        expect(shouldRetry('GET', 200, 0, options)).toBe(false);
        expect(shouldRetry('GET', 400, 0, options)).toBe(false);
        expect(shouldRetry('GET', 401, 0, options)).toBe(false);
        expect(shouldRetry('GET', 404, 0, options)).toBe(false);
      });

      it('should respect custom status codes list', () => {
        // Arrange
        const options = { ...baseOptions, statusCodes: [400, 401] };

        // Act & Assert
        expect(shouldRetry('GET', 400, 0, options)).toBe(true);
        expect(shouldRetry('GET', 401, 0, options)).toBe(true);
        expect(shouldRetry('GET', 500, 0, options)).toBe(false);
      });

      it('should use default status codes when not specified', () => {
        // Arrange
        const options = { limit: 2, methods: ['GET'] } as any;

        // Act & Assert
        expect(shouldRetry('GET', 500, 0, options)).toBe(true);
        expect(shouldRetry('GET', 400, 0, options)).toBe(false);
      });
    });

    describe('combined checks', () => {
      it('should return true only when all conditions are met', () => {
        // Arrange
        const options = {
          limit: 3,
          methods: ['GET', 'POST'] as const,
          statusCodes: [500, 502],
        };

        // Act & Assert
        // All conditions met
        expect(shouldRetry('GET', 500, 0, options as any)).toBe(true);
        // Wrong method
        expect(shouldRetry('PUT', 500, 0, options as any)).toBe(false);
        // Wrong status
        expect(shouldRetry('GET', 400, 0, options as any)).toBe(false);
        // Over limit
        expect(shouldRetry('GET', 500, 3, options as any)).toBe(false);
      });
    });
  });

  describe('calculateRetryDelay', () => {
    it('should use custom delay function when provided', () => {
      // Arrange
      const customDelay = vi.fn((attempt: number) => attempt * 1000);
      const options = { delay: customDelay };

      // Act
      const delay = calculateRetryDelay(2, options);

      // Assert
      expect(customDelay).toHaveBeenCalledWith(2);
      expect(delay).toBe(2000);
    });

    it('should use default delay function when not provided', () => {
      // Arrange
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const options = {};

      // Act
      const delay = calculateRetryDelay(0, options);

      // Assert
      expect(delay).toBeGreaterThan(300);
      expect(delay).toBeLessThan(400);

      mockRandom.mockRestore();
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve after specified duration', async () => {
      // Arrange
      const duration = 1000;
      let resolved = false;

      // Act
      const promise = sleep(duration).then(() => {
        resolved = true;
      });

      // Assert - not resolved immediately
      expect(resolved).toBe(false);

      // Advance time
      await vi.advanceTimersByTimeAsync(duration);

      // Assert - now resolved
      await promise;
      expect(resolved).toBe(true);
    });

    it('should work with zero duration', async () => {
      // Arrange & Act
      const promise = sleep(0);
      await vi.advanceTimersByTimeAsync(0);

      // Assert
      await expect(promise).resolves.toBeUndefined();
    });

    it('should work with various durations', async () => {
      // Arrange
      const durations = [100, 500, 1000, 5000];

      for (const duration of durations) {
        // Act
        const start = Date.now();
        const promise = sleep(duration);
        await vi.advanceTimersByTimeAsync(duration);
        await promise;

        // Assert - promise resolved
        expect(true).toBe(true);
      }
    });
  });
});
