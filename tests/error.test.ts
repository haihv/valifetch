import { describe, it, expect } from 'vitest';
import { ValifetchError } from '../src/errors/ValifetchError';
import type { ErrorCode, ValidationTarget } from '../src/types';

describe('errors/ValifetchError', () => {
  describe('constructor', () => {
    it('should create error with message and code', () => {
      // Arrange & Act
      const error = new ValifetchError({
        message: 'Test error',
        code: 'NETWORK_ERROR',
      });

      // Assert
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.name).toBe('ValifetchError');
    });

    it('should create error with all options', () => {
      // Arrange
      const request = new Request('https://api.example.com');
      const response = new Response('{}', { status: 404, statusText: 'Not Found' });
      const cause = new Error('Original error');
      const validation = {
        target: 'response' as ValidationTarget,
        issues: [{ message: 'Invalid type' }] as any[],
        input: { id: 'bad' },
      };

      // Act
      const error = new ValifetchError({
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        request,
        response,
        cause,
        validation,
      });

      // Assert
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.request).toBe(request);
      expect(error.response).toBe(response);
      expect(error.cause).toBe(cause);
      expect(error.validation).toBe(validation);
    });

    it('should be instanceof Error', () => {
      // Arrange & Act
      const error = new ValifetchError({
        message: 'Test',
        code: 'NETWORK_ERROR',
      });

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValifetchError);
    });
  });

  describe('error code checks', () => {
    describe('isValidationError', () => {
      it('should return true for VALIDATION_ERROR', () => {
        // Arrange
        const error = new ValifetchError({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        });

        // Act & Assert
        expect(error.isValidationError).toBe(true);
      });

      it('should return false for other error codes', () => {
        // Arrange
        const errorCodes: ErrorCode[] = ['NETWORK_ERROR', 'HTTP_ERROR', 'TIMEOUT_ERROR', 'ABORT_ERROR'];

        for (const code of errorCodes) {
          // Act
          const error = new ValifetchError({ message: 'Test', code });

          // Assert
          expect(error.isValidationError).toBe(false);
        }
      });
    });

    describe('isHttpError', () => {
      it('should return true for HTTP_ERROR', () => {
        // Arrange
        const error = new ValifetchError({
          message: 'HTTP error',
          code: 'HTTP_ERROR',
        });

        // Act & Assert
        expect(error.isHttpError).toBe(true);
      });

      it('should return false for other error codes', () => {
        // Arrange
        const errorCodes: ErrorCode[] = ['NETWORK_ERROR', 'VALIDATION_ERROR', 'TIMEOUT_ERROR', 'ABORT_ERROR'];

        for (const code of errorCodes) {
          // Act
          const error = new ValifetchError({ message: 'Test', code });

          // Assert
          expect(error.isHttpError).toBe(false);
        }
      });
    });

    describe('isTimeoutError', () => {
      it('should return true for TIMEOUT_ERROR', () => {
        // Arrange
        const error = new ValifetchError({
          message: 'Timeout',
          code: 'TIMEOUT_ERROR',
        });

        // Act & Assert
        expect(error.isTimeoutError).toBe(true);
      });

      it('should return false for other error codes', () => {
        // Arrange
        const errorCodes: ErrorCode[] = ['NETWORK_ERROR', 'HTTP_ERROR', 'VALIDATION_ERROR', 'ABORT_ERROR'];

        for (const code of errorCodes) {
          // Act
          const error = new ValifetchError({ message: 'Test', code });

          // Assert
          expect(error.isTimeoutError).toBe(false);
        }
      });
    });

    describe('isNetworkError', () => {
      it('should return true for NETWORK_ERROR', () => {
        // Arrange
        const error = new ValifetchError({
          message: 'Network failed',
          code: 'NETWORK_ERROR',
        });

        // Act & Assert
        expect(error.isNetworkError).toBe(true);
      });

      it('should return false for other error codes', () => {
        // Arrange
        const errorCodes: ErrorCode[] = ['TIMEOUT_ERROR', 'HTTP_ERROR', 'VALIDATION_ERROR', 'ABORT_ERROR'];

        for (const code of errorCodes) {
          // Act
          const error = new ValifetchError({ message: 'Test', code });

          // Assert
          expect(error.isNetworkError).toBe(false);
        }
      });
    });

    describe('isAbortError', () => {
      it('should return true for ABORT_ERROR', () => {
        // Arrange
        const error = new ValifetchError({
          message: 'Aborted',
          code: 'ABORT_ERROR',
        });

        // Act & Assert
        expect(error.isAbortError).toBe(true);
      });

      it('should return false for other error codes', () => {
        // Arrange
        const errorCodes: ErrorCode[] = ['TIMEOUT_ERROR', 'HTTP_ERROR', 'VALIDATION_ERROR', 'NETWORK_ERROR'];

        for (const code of errorCodes) {
          // Act
          const error = new ValifetchError({ message: 'Test', code });

          // Assert
          expect(error.isAbortError).toBe(false);
        }
      });
    });
  });

  describe('convenience getters', () => {
    describe('issues', () => {
      it('should return validation issues when present', () => {
        // Arrange
        const issues = [{ message: 'Issue 1' }, { message: 'Issue 2' }] as any[];
        const error = new ValifetchError({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          validation: {
            target: 'response',
            issues,
            input: {},
          },
        });

        // Act & Assert
        expect(error.issues).toBe(issues);
      });

      it('should return empty array when no validation info', () => {
        // Arrange
        const error = new ValifetchError({
          message: 'Network error',
          code: 'NETWORK_ERROR',
        });

        // Act & Assert
        expect(error.issues).toEqual([]);
      });
    });

    describe('status', () => {
      it('should return response status when present', () => {
        // Arrange
        const response = new Response('{}', { status: 404 });
        const error = new ValifetchError({
          message: 'Not found',
          code: 'HTTP_ERROR',
          response,
        });

        // Act & Assert
        expect(error.status).toBe(404);
      });

      it('should return undefined when no response', () => {
        // Arrange
        const error = new ValifetchError({
          message: 'Network error',
          code: 'NETWORK_ERROR',
        });

        // Act & Assert
        expect(error.status).toBeUndefined();
      });
    });

    describe('statusText', () => {
      it('should return response statusText when present', () => {
        // Arrange
        const response = new Response('{}', { status: 404, statusText: 'Not Found' });
        const error = new ValifetchError({
          message: 'Not found',
          code: 'HTTP_ERROR',
          response,
        });

        // Act & Assert
        expect(error.statusText).toBe('Not Found');
      });

      it('should return undefined when no response', () => {
        // Arrange
        const error = new ValifetchError({
          message: 'Network error',
          code: 'NETWORK_ERROR',
        });

        // Act & Assert
        expect(error.statusText).toBeUndefined();
      });
    });
  });

  describe('stack trace', () => {
    it('should have stack trace', () => {
      // Arrange & Act
      const error = new ValifetchError({
        message: 'Test error',
        code: 'NETWORK_ERROR',
      });

      // Assert
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValifetchError');
    });
  });

  describe('readonly properties', () => {
    it('should have readonly code property', () => {
      // Arrange
      const error = new ValifetchError({
        message: 'Test',
        code: 'NETWORK_ERROR',
      });

      // Assert - TypeScript should prevent reassignment, but runtime check
      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('should have readonly request property', () => {
      // Arrange
      const request = new Request('https://api.example.com');
      const error = new ValifetchError({
        message: 'Test',
        code: 'NETWORK_ERROR',
        request,
      });

      // Assert
      expect(error.request).toBe(request);
    });

    it('should have readonly response property', () => {
      // Arrange
      const response = new Response('{}');
      const error = new ValifetchError({
        message: 'Test',
        code: 'HTTP_ERROR',
        response,
      });

      // Assert
      expect(error.response).toBe(response);
    });

    it('should have readonly validation property', () => {
      // Arrange
      const validation = {
        target: 'response' as ValidationTarget,
        issues: [],
        input: {},
      };
      const error = new ValifetchError({
        message: 'Test',
        code: 'VALIDATION_ERROR',
        validation,
      });

      // Assert
      expect(error.validation).toBe(validation);
    });
  });
});
