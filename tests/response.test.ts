import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
  checkResponseStatus,
  parseJsonResponse,
  parseTextResponse,
  parseArrayBufferResponse,
  parseBlobResponse,
  parseFormDataResponse,
} from '../src/core/response';
import { ValifetchError } from '../src/errors/ValifetchError';

describe('core/response', () => {
  const createRequest = () => new Request('https://api.example.com/users');

  describe('checkResponseStatus', () => {
    describe('when response is OK', () => {
      it('should not throw for 200 status', () => {
        // Arrange
        const response = new Response('{}', { status: 200 });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).not.toThrow();
      });

      it('should not throw for 201 status', () => {
        // Arrange
        const response = new Response('{}', { status: 201 });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).not.toThrow();
      });

      it('should not throw for 204 status', () => {
        // Arrange
        const response = new Response(null, { status: 204 });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).not.toThrow();
      });
    });

    describe('when response is not OK and throwHttpErrors is true', () => {
      it('should throw ValifetchError for 400 status', () => {
        // Arrange
        const response = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).toThrow(ValifetchError);
      });

      it('should throw ValifetchError for 401 status', () => {
        // Arrange
        const response = new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).toThrow(ValifetchError);
      });

      it('should throw ValifetchError for 404 status', () => {
        // Arrange
        const response = new Response('Not Found', { status: 404, statusText: 'Not Found' });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).toThrow(ValifetchError);
      });

      it('should throw ValifetchError for 500 status', () => {
        // Arrange
        const response = new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).toThrow(ValifetchError);
      });

      it('should include correct error code', () => {
        // Arrange
        const response = new Response('Not Found', { status: 404, statusText: 'Not Found' });
        const request = createRequest();

        // Act & Assert
        try {
          checkResponseStatus(response, request, true);
          expect.fail('Should have thrown');
        } catch (error) {
          expect((error as ValifetchError).code).toBe('HTTP_ERROR');
        }
      });

      it('should include request in error', () => {
        // Arrange
        const response = new Response('Error', { status: 500 });
        const request = createRequest();

        // Act & Assert
        try {
          checkResponseStatus(response, request, true);
          expect.fail('Should have thrown');
        } catch (error) {
          expect((error as ValifetchError).request).toBe(request);
        }
      });

      it('should include response in error', () => {
        // Arrange
        const response = new Response('Error', { status: 500 });
        const request = createRequest();

        // Act & Assert
        try {
          checkResponseStatus(response, request, true);
          expect.fail('Should have thrown');
        } catch (error) {
          expect((error as ValifetchError).response).toBe(response);
        }
      });

      it('should include status in error message', () => {
        // Arrange
        const response = new Response('Not Found', { status: 404, statusText: 'Not Found' });
        const request = createRequest();

        // Act & Assert
        try {
          checkResponseStatus(response, request, true);
          expect.fail('Should have thrown');
        } catch (error) {
          expect((error as ValifetchError).message).toContain('404');
          expect((error as ValifetchError).message).toContain('Not Found');
        }
      });
    });

    describe('when throwHttpErrors is false', () => {
      it('should not throw for non-OK response', () => {
        // Arrange
        const response = new Response('Not Found', { status: 404 });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, false)).not.toThrow();
      });

      it('should not throw for 500 status', () => {
        // Arrange
        const response = new Response('Server Error', { status: 500 });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, false)).not.toThrow();
      });
    });
  });

  describe('parseJsonResponse', () => {
    describe('successful parsing', () => {
      it('should parse valid JSON response', async () => {
        // Arrange
        const response = new Response('{"id": 1, "name": "John"}', { status: 200 });
        const request = createRequest();

        // Act
        const result = await parseJsonResponse({
          response,
          request,
          validateResponse: false,
          throwHttpErrors: true,
        });

        // Assert
        expect(result).toEqual({ id: 1, name: 'John' });
      });

      it('should parse empty object', async () => {
        // Arrange
        const response = new Response('{}', { status: 200 });
        const request = createRequest();

        // Act
        const result = await parseJsonResponse({
          response,
          request,
          validateResponse: false,
          throwHttpErrors: true,
        });

        // Assert
        expect(result).toEqual({});
      });

      it('should parse array response', async () => {
        // Arrange
        const response = new Response('[1, 2, 3]', { status: 200 });
        const request = createRequest();

        // Act
        const result = await parseJsonResponse({
          response,
          request,
          validateResponse: false,
          throwHttpErrors: true,
        });

        // Assert
        expect(result).toEqual([1, 2, 3]);
      });
    });

    describe('with schema validation', () => {
      it('should validate and return data when valid', async () => {
        // Arrange
        const response = new Response('{"id": 1, "name": "John"}', { status: 200 });
        const request = createRequest();
        const responseSchema = v.object({
          id: v.number(),
          name: v.string(),
        });

        // Act
        const result = await parseJsonResponse({
          response,
          request,
          responseSchema,
          validateResponse: true,
          throwHttpErrors: true,
        });

        // Assert
        expect(result).toEqual({ id: 1, name: 'John' });
      });

      it('should throw ValifetchError when validation fails', async () => {
        // Arrange
        const response = new Response('{"id": "not-a-number"}', { status: 200 });
        const request = createRequest();
        const responseSchema = v.object({
          id: v.number(),
        });

        // Act & Assert
        await expect(
          parseJsonResponse({
            response,
            request,
            responseSchema,
            validateResponse: true,
            throwHttpErrors: true,
          })
        ).rejects.toThrow(ValifetchError);
      });

      it('should skip validation when validateResponse is false', async () => {
        // Arrange
        const response = new Response('{"id": "not-a-number"}', { status: 200 });
        const request = createRequest();
        const responseSchema = v.object({
          id: v.number(),
        });

        // Act
        const result = await parseJsonResponse({
          response,
          request,
          responseSchema,
          validateResponse: false,
          throwHttpErrors: true,
        });

        // Assert
        expect(result).toEqual({ id: 'not-a-number' });
      });
    });

    describe('JSON parsing errors', () => {
      it('should throw ValifetchError for invalid JSON', async () => {
        // Arrange
        const response = new Response('not valid json', { status: 200 });
        const request = createRequest();

        // Act & Assert
        await expect(
          parseJsonResponse({
            response,
            request,
            validateResponse: false,
            throwHttpErrors: true,
          })
        ).rejects.toThrow(ValifetchError);
      });

      it('should have NETWORK_ERROR code for JSON parse error', async () => {
        // Arrange
        const response = new Response('invalid', { status: 200 });
        const request = createRequest();

        // Act & Assert
        try {
          await parseJsonResponse({
            response,
            request,
            validateResponse: false,
            throwHttpErrors: true,
          });
          expect.fail('Should have thrown');
        } catch (error) {
          expect((error as ValifetchError).code).toBe('NETWORK_ERROR');
          expect((error as ValifetchError).message).toContain('Failed to parse response as JSON');
        }
      });

      it('should include cause error for JSON parse failure', async () => {
        // Arrange
        const response = new Response('invalid json', { status: 200 });
        const request = createRequest();

        // Act & Assert
        try {
          await parseJsonResponse({
            response,
            request,
            validateResponse: false,
            throwHttpErrors: true,
          });
          expect.fail('Should have thrown');
        } catch (error) {
          expect((error as ValifetchError).cause).toBeDefined();
        }
      });

      it('should handle non-Error thrown during JSON parse', async () => {
        // Arrange
        const response = {
          ok: true,
          status: 200,
          json: () => Promise.reject('non-error'),
        } as unknown as Response;
        const request = createRequest();

        // Act & Assert
        try {
          await parseJsonResponse({
            response,
            request,
            validateResponse: false,
            throwHttpErrors: true,
          });
          expect.fail('Should have thrown');
        } catch (error) {
          expect((error as ValifetchError).cause).toBeUndefined();
        }
      });
    });

    describe('HTTP errors', () => {
      it('should check status before parsing', async () => {
        // Arrange
        const response = new Response('{"error": "Not Found"}', { status: 404, statusText: 'Not Found' });
        const request = createRequest();

        // Act & Assert
        await expect(
          parseJsonResponse({
            response,
            request,
            validateResponse: false,
            throwHttpErrors: true,
          })
        ).rejects.toThrow(ValifetchError);
      });
    });
  });

  describe('parseTextResponse', () => {
    it('should return text content', async () => {
      // Arrange
      const response = new Response('Hello, World!', { status: 200 });
      const request = createRequest();

      // Act
      const result = await parseTextResponse(response, request, true);

      // Assert
      expect(result).toBe('Hello, World!');
    });

    it('should throw for non-OK response when throwHttpErrors is true', async () => {
      // Arrange
      const response = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      const request = createRequest();

      // Act & Assert
      await expect(parseTextResponse(response, request, true)).rejects.toThrow(ValifetchError);
    });

    it('should not throw for non-OK response when throwHttpErrors is false', async () => {
      // Arrange
      const response = new Response('Not Found', { status: 404 });
      const request = createRequest();

      // Act
      const result = await parseTextResponse(response, request, false);

      // Assert
      expect(result).toBe('Not Found');
    });
  });

  describe('parseArrayBufferResponse', () => {
    it('should return ArrayBuffer', async () => {
      // Arrange
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const response = new Response(data, { status: 200 });
      const request = createRequest();

      // Act
      const result = await parseArrayBufferResponse(response, request, true);

      // Assert
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(result)).toEqual(data);
    });

    it('should throw for non-OK response when throwHttpErrors is true', async () => {
      // Arrange
      const response = new Response('Error', { status: 500, statusText: 'Error' });
      const request = createRequest();

      // Act & Assert
      await expect(parseArrayBufferResponse(response, request, true)).rejects.toThrow(ValifetchError);
    });
  });

  describe('parseBlobResponse', () => {
    it('should return Blob', async () => {
      // Arrange
      const data = new Blob(['Hello'], { type: 'text/plain' });
      const response = new Response(data, { status: 200 });
      const request = createRequest();

      // Act
      const result = await parseBlobResponse(response, request, true);

      // Assert
      expect(result).toBeInstanceOf(Blob);
      expect(await result.text()).toBe('Hello');
    });

    it('should throw for non-OK response when throwHttpErrors is true', async () => {
      // Arrange
      const response = new Response('Error', { status: 500, statusText: 'Error' });
      const request = createRequest();

      // Act & Assert
      await expect(parseBlobResponse(response, request, true)).rejects.toThrow(ValifetchError);
    });
  });

  describe('parseFormDataResponse', () => {
    it('should return FormData', async () => {
      // Arrange
      const formData = new FormData();
      formData.append('name', 'John');
      formData.append('email', 'john@example.com');
      const response = new Response(formData, { status: 200 });
      const request = createRequest();

      // Act
      const result = await parseFormDataResponse(response, request, true);

      // Assert
      expect(result).toBeInstanceOf(FormData);
      expect(result.get('name')).toBe('John');
      expect(result.get('email')).toBe('john@example.com');
    });

    it('should throw for non-OK response when throwHttpErrors is true', async () => {
      // Arrange
      const response = new Response('Error', { status: 500, statusText: 'Error' });
      const request = createRequest();

      // Act & Assert
      await expect(parseFormDataResponse(response, request, true)).rejects.toThrow(ValifetchError);
    });
  });
});
