import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import {
  checkResponseStatus,
  parseJsonResponse,
  wrapResponseWithProgress,
} from '../src/core/response';
import { ValifetchError } from '../src/errors/ValifetchError';
import type { DownloadProgressEvent } from '../src/types/options';

describe('core/response', () => {
  const createRequest = () => new Request('https://api.example.com/users');

  describe('checkResponseStatus', () => {
    describe('when response is OK', () => {
      it('should not throw for 200 status', () => {
        // Arrange
        const response = new Response('{}', { status: 200 });
        const request = createRequest();

        // Act & Assert
        expect(() =>
          checkResponseStatus(response, request, true)
        ).not.toThrow();
      });

      it('should not throw for 201 status', () => {
        // Arrange
        const response = new Response('{}', { status: 201 });
        const request = createRequest();

        // Act & Assert
        expect(() =>
          checkResponseStatus(response, request, true)
        ).not.toThrow();
      });

      it('should not throw for 204 status', () => {
        // Arrange
        const response = new Response(null, { status: 204 });
        const request = createRequest();

        // Act & Assert
        expect(() =>
          checkResponseStatus(response, request, true)
        ).not.toThrow();
      });
    });

    describe('when response is not OK and throwHttpErrors is true', () => {
      it('should throw ValifetchError for 400 status', () => {
        // Arrange
        const response = new Response('Bad Request', {
          status: 400,
          statusText: 'Bad Request',
        });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).toThrow(
          ValifetchError
        );
      });

      it('should throw ValifetchError for 401 status', () => {
        // Arrange
        const response = new Response('Unauthorized', {
          status: 401,
          statusText: 'Unauthorized',
        });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).toThrow(
          ValifetchError
        );
      });

      it('should throw ValifetchError for 404 status', () => {
        // Arrange
        const response = new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).toThrow(
          ValifetchError
        );
      });

      it('should throw ValifetchError for 500 status', () => {
        // Arrange
        const response = new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        });
        const request = createRequest();

        // Act & Assert
        expect(() => checkResponseStatus(response, request, true)).toThrow(
          ValifetchError
        );
      });

      it('should include correct error code', () => {
        // Arrange
        const response = new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        });
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
        const response = new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        });
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
        expect(() =>
          checkResponseStatus(response, request, false)
        ).not.toThrow();
      });

      it('should not throw for 500 status', () => {
        // Arrange
        const response = new Response('Server Error', { status: 500 });
        const request = createRequest();

        // Act & Assert
        expect(() =>
          checkResponseStatus(response, request, false)
        ).not.toThrow();
      });
    });
  });

  describe('parseJsonResponse', () => {
    describe('successful parsing', () => {
      it('should parse valid JSON response', async () => {
        // Arrange
        const response = new Response('{"id": 1, "name": "John"}', {
          status: 200,
        });
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
        const response = new Response('{"id": 1, "name": "John"}', {
          status: 200,
        });
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
        const response = new Response('{"id": "not-a-number"}', {
          status: 200,
        });
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
        const response = new Response('{"id": "not-a-number"}', {
          status: 200,
        });
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

      it('should have PARSE_ERROR code for JSON parse error', async () => {
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
          expect((error as ValifetchError).code).toBe('PARSE_ERROR');
          expect((error as ValifetchError).message).toContain(
            'Failed to parse response as JSON'
          );
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
      it('should parse JSON even for non-OK status (status check is done by caller)', async () => {
        // Arrange - parseJsonResponse only parses JSON, status check is handled by handleResponse
        const response = new Response('{"error": "Not Found"}', {
          status: 404,
          statusText: 'Not Found',
        });
        const request = createRequest();

        // Act
        const result = await parseJsonResponse({
          response,
          request,
          validateResponse: false,
          throwHttpErrors: true,
        });

        // Assert - it should parse the JSON body regardless of status
        expect(result).toEqual({ error: 'Not Found' });
      });
    });
  });

  describe('wrapResponseWithProgress', () => {
    const makeStreamResponse = (
      chunks: Uint8Array[],
      contentLength?: number
    ): Response => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const headers: Record<string, string> = {};
      if (contentLength !== undefined) {
        headers['content-length'] = String(contentLength);
      }

      return new Response(stream, { status: 200, headers });
    };

    it('returns the original response unchanged when body is null', () => {
      // Arrange
      const response = new Response(null, { status: 204 });
      const callback = vi.fn();

      // Act
      const result = wrapResponseWithProgress(response, callback);

      // Assert
      expect(result).toBe(response);
      expect(callback).not.toHaveBeenCalled();
    });

    it('fires callback for each chunk with correct loaded/total/percent when Content-Length is present', async () => {
      // Arrange
      const encoder = new TextEncoder();
      const chunk1 = encoder.encode('hel');
      const chunk2 = encoder.encode('lo');
      const total = chunk1.byteLength + chunk2.byteLength;

      const response = makeStreamResponse([chunk1, chunk2], total);
      const events: DownloadProgressEvent[] = [];
      const onDownloadProgress = (e: DownloadProgressEvent) => events.push(e);

      // Act
      const wrapped = wrapResponseWithProgress(response, onDownloadProgress);
      await wrapped.text(); // consume the body to drive the stream

      // Assert
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        loaded: chunk1.byteLength,
        total,
        percent: (chunk1.byteLength / total) * 100,
      });
      expect(events[1]).toEqual({
        loaded: total,
        total,
        percent: 100,
      });
    });

    it('fires callback with undefined total/percent when no Content-Length header', async () => {
      // Arrange
      const encoder = new TextEncoder();
      const chunk = encoder.encode('hello');
      const response = makeStreamResponse([chunk]);

      const events: DownloadProgressEvent[] = [];
      const wrapped = wrapResponseWithProgress(response, (e) => events.push(e));

      // Act
      await wrapped.text();

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].loaded).toBe(chunk.byteLength);
      expect(events[0].total).toBeUndefined();
      expect(events[0].percent).toBeUndefined();
    });

    it('preserves response status and headers on the wrapped response', () => {
      // Arrange
      const encoder = new TextEncoder();
      const chunk = encoder.encode('x');
      const response = makeStreamResponse([chunk], 1);

      // Act
      const wrapped = wrapResponseWithProgress(response, vi.fn());

      // Assert
      expect(wrapped.status).toBe(200);
      expect(wrapped.headers.get('content-length')).toBe('1');
    });

    it('caps percent at 100 even if loaded exceeds total', async () => {
      // Arrange — simulate a Content-Length that is smaller than actual data
      const encoder = new TextEncoder();
      const chunk = encoder.encode('hello world'); // 11 bytes
      // Declare a smaller content-length than actual (edge case)
      const response = makeStreamResponse([chunk], 5);

      const events: DownloadProgressEvent[] = [];
      const wrapped = wrapResponseWithProgress(response, (e) => events.push(e));

      // Act
      await wrapped.text();

      // Assert
      expect(events[0].percent).toBe(100); // capped by Math.min
    });
  });
});
