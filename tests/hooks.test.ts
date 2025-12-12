import { describe, it, expect, vi } from 'vitest';
import {
  runBeforeRequestHooks,
  runAfterResponseHooks,
} from '../src/core/hooks';
import type {
  NormalizedOptions,
  BeforeRequestHook,
  AfterResponseHook,
} from '../src/types';

describe('core/hooks', () => {
  const createMockOptions = (): NormalizedOptions => ({
    method: 'GET',
    headers: new Headers(),
    validateResponse: true,
    validateRequest: true,
    throwHttpErrors: true,
  });

  describe('runBeforeRequestHooks', () => {
    describe('when no hooks provided', () => {
      it('should return original request when hooks is undefined', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const options = createMockOptions();

        // Act
        const result = await runBeforeRequestHooks(request, options, undefined);

        // Assert
        expect(result).toBe(request);
      });

      it('should return original request when hooks array is empty', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const options = createMockOptions();

        // Act
        const result = await runBeforeRequestHooks(request, options, []);

        // Assert
        expect(result).toBe(request);
      });
    });

    describe('when hooks return void', () => {
      it('should return original request when hook returns undefined', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const options = createMockOptions();
        const hook: BeforeRequestHook = vi.fn().mockResolvedValue(undefined);

        // Act
        const result = await runBeforeRequestHooks(request, options, [hook]);

        // Assert
        expect(result).toBe(request);
        expect(hook).toHaveBeenCalledWith(request, options);
      });

      it('should call all hooks in sequence', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const options = createMockOptions();
        const callOrder: number[] = [];

        const hook1: BeforeRequestHook = vi
          .fn()
          .mockImplementation(async () => {
            callOrder.push(1);
            return undefined;
          });
        const hook2: BeforeRequestHook = vi
          .fn()
          .mockImplementation(async () => {
            callOrder.push(2);
            return undefined;
          });
        const hook3: BeforeRequestHook = vi
          .fn()
          .mockImplementation(async () => {
            callOrder.push(3);
            return undefined;
          });

        // Act
        await runBeforeRequestHooks(request, options, [hook1, hook2, hook3]);

        // Assert
        expect(callOrder).toEqual([1, 2, 3]);
      });
    });

    describe('when hook returns modified Request', () => {
      it('should return modified request from hook', async () => {
        // Arrange
        const originalRequest = new Request('https://api.example.com/users');
        const modifiedRequest = new Request('https://api.example.com/users', {
          headers: { 'X-Custom': 'value' },
        });
        const options = createMockOptions();
        const hook: BeforeRequestHook = vi
          .fn()
          .mockResolvedValue(modifiedRequest);

        // Act
        const result = await runBeforeRequestHooks(originalRequest, options, [
          hook,
        ]);

        // Assert
        expect(result).toBe(modifiedRequest);
      });

      it('should pass modified request to subsequent hooks', async () => {
        // Arrange
        const originalRequest = new Request('https://api.example.com/users');
        const modifiedRequest = new Request('https://api.example.com/v2/users');
        const options = createMockOptions();

        const hook1: BeforeRequestHook = vi
          .fn()
          .mockResolvedValue(modifiedRequest);
        const hook2: BeforeRequestHook = vi.fn().mockResolvedValue(undefined);

        // Act
        await runBeforeRequestHooks(originalRequest, options, [hook1, hook2]);

        // Assert
        expect(hook2).toHaveBeenCalledWith(modifiedRequest, options);
      });
    });

    describe('when hook returns Response', () => {
      it('should return Response and skip remaining hooks', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const mockResponse = new Response('{"cached": true}', { status: 200 });
        const options = createMockOptions();

        const hook1: BeforeRequestHook = vi
          .fn()
          .mockResolvedValue(mockResponse);
        const hook2: BeforeRequestHook = vi.fn();

        // Act
        const result = await runBeforeRequestHooks(request, options, [
          hook1,
          hook2,
        ]);

        // Assert
        expect(result).toBe(mockResponse);
        expect(hook2).not.toHaveBeenCalled();
      });

      it('should return Response from any hook in sequence', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const mockResponse = new Response('{"cached": true}', { status: 200 });
        const options = createMockOptions();

        const hook1: BeforeRequestHook = vi.fn().mockResolvedValue(undefined);
        const hook2: BeforeRequestHook = vi
          .fn()
          .mockResolvedValue(mockResponse);
        const hook3: BeforeRequestHook = vi.fn();

        // Act
        const result = await runBeforeRequestHooks(request, options, [
          hook1,
          hook2,
          hook3,
        ]);

        // Assert
        expect(result).toBe(mockResponse);
        expect(hook1).toHaveBeenCalled();
        expect(hook2).toHaveBeenCalled();
        expect(hook3).not.toHaveBeenCalled();
      });
    });

    describe('async hooks', () => {
      it('should wait for async hooks', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const options = createMockOptions();
        let hookCompleted = false;

        const asyncHook: BeforeRequestHook = async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          hookCompleted = true;
          return undefined;
        };

        // Act
        await runBeforeRequestHooks(request, options, [asyncHook]);

        // Assert
        expect(hookCompleted).toBe(true);
      });
    });
  });

  describe('runAfterResponseHooks', () => {
    describe('when no hooks provided', () => {
      it('should return original response when hooks is undefined', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const response = new Response('{}', { status: 200 });
        const options = createMockOptions();

        // Act
        const result = await runAfterResponseHooks(
          request,
          options,
          response,
          undefined
        );

        // Assert
        expect(result).toBe(response);
      });

      it('should return original response when hooks array is empty', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const response = new Response('{}', { status: 200 });
        const options = createMockOptions();

        // Act
        const result = await runAfterResponseHooks(
          request,
          options,
          response,
          []
        );

        // Assert
        expect(result).toBe(response);
      });
    });

    describe('when hooks return void', () => {
      it('should return original response when hook returns undefined', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const response = new Response('{}', { status: 200 });
        const options = createMockOptions();
        const hook: AfterResponseHook = vi.fn().mockResolvedValue(undefined);

        // Act
        const result = await runAfterResponseHooks(request, options, response, [
          hook,
        ]);

        // Assert
        expect(result).toBe(response);
        expect(hook).toHaveBeenCalledWith(request, options, response);
      });

      it('should call all hooks in sequence', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const response = new Response('{}', { status: 200 });
        const options = createMockOptions();
        const callOrder: number[] = [];

        const hook1: AfterResponseHook = vi
          .fn()
          .mockImplementation(async () => {
            callOrder.push(1);
            return undefined;
          });
        const hook2: AfterResponseHook = vi
          .fn()
          .mockImplementation(async () => {
            callOrder.push(2);
            return undefined;
          });

        // Act
        await runAfterResponseHooks(request, options, response, [hook1, hook2]);

        // Assert
        expect(callOrder).toEqual([1, 2]);
      });
    });

    describe('when hook returns modified Response', () => {
      it('should return modified response from hook', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const originalResponse = new Response('{}', { status: 200 });
        const modifiedResponse = new Response('{"modified": true}', {
          status: 200,
        });
        const options = createMockOptions();
        const hook: AfterResponseHook = vi
          .fn()
          .mockResolvedValue(modifiedResponse);

        // Act
        const result = await runAfterResponseHooks(
          request,
          options,
          originalResponse,
          [hook]
        );

        // Assert
        expect(result).toBe(modifiedResponse);
      });

      it('should pass modified response to subsequent hooks', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const originalResponse = new Response('{}', { status: 200 });
        const modifiedResponse = new Response('{"modified": true}', {
          status: 200,
        });
        const options = createMockOptions();

        const hook1: AfterResponseHook = vi
          .fn()
          .mockResolvedValue(modifiedResponse);
        const hook2: AfterResponseHook = vi.fn().mockResolvedValue(undefined);

        // Act
        await runAfterResponseHooks(request, options, originalResponse, [
          hook1,
          hook2,
        ]);

        // Assert
        expect(hook2).toHaveBeenCalledWith(request, options, modifiedResponse);
      });

      it('should chain multiple response modifications', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const response1 = new Response('{}', { status: 200 });
        const response2 = new Response('{"step": 1}', { status: 200 });
        const response3 = new Response('{"step": 2}', { status: 200 });
        const options = createMockOptions();

        const hook1: AfterResponseHook = vi.fn().mockResolvedValue(response2);
        const hook2: AfterResponseHook = vi.fn().mockResolvedValue(response3);

        // Act
        const result = await runAfterResponseHooks(
          request,
          options,
          response1,
          [hook1, hook2]
        );

        // Assert
        expect(result).toBe(response3);
        expect(hook1).toHaveBeenCalledWith(request, options, response1);
        expect(hook2).toHaveBeenCalledWith(request, options, response2);
      });
    });

    describe('async hooks', () => {
      it('should wait for async hooks', async () => {
        // Arrange
        const request = new Request('https://api.example.com/users');
        const response = new Response('{}', { status: 200 });
        const options = createMockOptions();
        let hookCompleted = false;

        const asyncHook: AfterResponseHook = async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          hookCompleted = true;
          return undefined;
        };

        // Act
        await runAfterResponseHooks(request, options, response, [asyncHook]);

        // Assert
        expect(hookCompleted).toBe(true);
      });
    });
  });
});
