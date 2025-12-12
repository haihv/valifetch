import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { validate, safeValidate } from '../src/validation/validate';
import { ValifetchError } from '../src/errors/ValifetchError';

describe('validation/validate', () => {
  describe('validate', () => {
    describe('successful validation', () => {
      it('should return validated data for valid input', () => {
        // Arrange
        const schema = v.object({
          id: v.number(),
          name: v.string(),
        });
        const data = { id: 1, name: 'John' };

        // Act
        const result = validate({
          schema,
          data,
          target: 'response',
        });

        // Assert
        expect(result).toEqual({ id: 1, name: 'John' });
      });

      it('should transform data according to schema', () => {
        // Arrange
        const schema = v.object({
          id: v.pipe(v.string(), v.transform(Number)),
        });
        const data = { id: '123' };

        // Act
        const result = validate({
          schema,
          data,
          target: 'body',
        });

        // Assert
        expect(result).toEqual({ id: 123 });
      });

      it('should handle nested objects', () => {
        // Arrange
        const schema = v.object({
          user: v.object({
            profile: v.object({
              name: v.string(),
            }),
          }),
        });
        const data = { user: { profile: { name: 'Jane' } } };

        // Act
        const result = validate({
          schema,
          data,
          target: 'response',
        });

        // Assert
        expect(result).toEqual({ user: { profile: { name: 'Jane' } } });
      });

      it('should handle arrays', () => {
        // Arrange
        const schema = v.array(v.number());
        const data = [1, 2, 3];

        // Act
        const result = validate({
          schema,
          data,
          target: 'response',
        });

        // Assert
        expect(result).toEqual([1, 2, 3]);
      });

      it('should handle optional fields', () => {
        // Arrange
        const schema = v.object({
          id: v.number(),
          name: v.optional(v.string()),
        });
        const data = { id: 1 };

        // Act
        const result = validate({
          schema,
          data,
          target: 'response',
        });

        // Assert
        expect(result).toEqual({ id: 1 });
      });
    });

    describe('validation failures', () => {
      it('should throw ValifetchError for invalid data', () => {
        // Arrange
        const schema = v.object({
          id: v.number(),
        });
        const data = { id: 'not-a-number' };

        // Act & Assert
        expect(() =>
          validate({
            schema,
            data,
            target: 'response',
          })
        ).toThrow(ValifetchError);
      });

      it('should include target in error', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 'invalid' };

        // Act & Assert
        try {
          validate({ schema, data, target: 'body' });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect((error as ValifetchError).code).toBe('VALIDATION_ERROR');
          expect((error as ValifetchError).validation?.target).toBe('body');
        }
      });

      it('should include issues in error', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 'invalid' };

        // Act & Assert
        try {
          validate({ schema, data, target: 'params' });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect(
            (error as ValifetchError).validation?.issues.length
          ).toBeGreaterThan(0);
        }
      });

      it('should include input in error', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 'invalid' };

        // Act & Assert
        try {
          validate({ schema, data, target: 'search' });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect((error as ValifetchError).validation?.input).toEqual(data);
        }
      });

      it('should include request in error when provided', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 'invalid' };
        const request = new Request('https://api.example.com');

        // Act & Assert
        try {
          validate({ schema, data, target: 'response', request });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect((error as ValifetchError).request).toBe(request);
        }
      });

      it('should include response in error when provided', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 'invalid' };
        const response = new Response('{}', { status: 200 });

        // Act & Assert
        try {
          validate({ schema, data, target: 'response', response });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect((error as ValifetchError).response).toBe(response);
        }
      });

      it('should have proper error message', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 'invalid' };

        // Act & Assert
        try {
          validate({ schema, data, target: 'response' });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValifetchError);
          expect((error as ValifetchError).message).toBe(
            'Validation failed for response'
          );
        }
      });
    });

    describe('different validation targets', () => {
      it('should validate response target', () => {
        // Arrange
        const schema = v.object({ data: v.string() });
        const data = { data: 123 };

        // Act & Assert
        try {
          validate({ schema, data, target: 'response' });
        } catch (error) {
          expect((error as ValifetchError).validation?.target).toBe('response');
        }
      });

      it('should validate body target', () => {
        // Arrange
        const schema = v.object({ data: v.string() });
        const data = { data: 123 };

        // Act & Assert
        try {
          validate({ schema, data, target: 'body' });
        } catch (error) {
          expect((error as ValifetchError).validation?.target).toBe('body');
        }
      });

      it('should validate params target', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 'abc' };

        // Act & Assert
        try {
          validate({ schema, data, target: 'params' });
        } catch (error) {
          expect((error as ValifetchError).validation?.target).toBe('params');
        }
      });

      it('should validate search target', () => {
        // Arrange
        const schema = v.object({ page: v.number() });
        const data = { page: 'one' };

        // Act & Assert
        try {
          validate({ schema, data, target: 'search' });
        } catch (error) {
          expect((error as ValifetchError).validation?.target).toBe('search');
        }
      });
    });
  });

  describe('safeValidate', () => {
    describe('successful validation', () => {
      it('should return success result for valid data', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 123 };

        // Act
        const result = safeValidate(schema, data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ id: 123 });
        }
      });

      it('should transform data in success result', () => {
        // Arrange
        const schema = v.pipe(
          v.string(),
          v.transform((s) => s.toUpperCase())
        );
        const data = 'hello';

        // Act
        const result = safeValidate(schema, data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('HELLO');
        }
      });
    });

    describe('validation failures', () => {
      it('should return failure result for invalid data', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 'not-a-number' };

        // Act
        const result = safeValidate(schema, data);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.issues.length).toBeGreaterThan(0);
        }
      });

      it('should not throw error', () => {
        // Arrange
        const schema = v.object({ id: v.number() });
        const data = { id: 'invalid' };

        // Act & Assert
        expect(() => safeValidate(schema, data)).not.toThrow();
      });

      it('should include issues in failure result', () => {
        // Arrange
        const schema = v.object({
          id: v.number(),
          name: v.string(),
        });
        const data = { id: 'bad', name: 123 };

        // Act
        const result = safeValidate(schema, data);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.issues.length).toBeGreaterThanOrEqual(2);
        }
      });
    });
  });
});
