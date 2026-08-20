import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { valifetch } from '../../src/core/valifetch';
import { ValifetchError } from '../../src/errors/ValifetchError';
import type { BeforeErrorHook } from '../../src/types';

describe('hooks/beforeError', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const mockStatus = (status: number) => {
    fetchSpy.mockResolvedValue(new Response('{"message":"nope"}', { status }));
  };

  describe('when the pipeline throws a ValifetchError', () => {
    it('should pass an HTTP_ERROR to the hook and allow mutating it in place', async () => {
      // Arrange
      mockStatus(500);
      const received: ValifetchError[] = [];
      const client = valifetch.create({
        retry: false,
        hooks: {
          beforeError: [
            (error) => {
              received.push(error);
              error.message = `handled: ${error.message}`;
              return error;
            },
          ],
        },
      });

      // Act
      const error = (await client
        .get('https://api.example.com/users')
        .catch((e: unknown) => e)) as ValifetchError;

      // Assert
      expect(received).toHaveLength(1);
      expect(received[0]?.code).toBe('HTTP_ERROR');
      expect(error).toBe(received[0]);
      expect(error.message).toMatch(/^handled: /);
    });

    it('should throw the replacement error returned by the hook', async () => {
      // Arrange
      mockStatus(500);
      const replacement = new ValifetchError({
        message: 'replaced',
        code: 'VALIDATION_ERROR',
      });
      const client = valifetch.create({
        retry: false,
        hooks: { beforeError: [() => replacement] },
      });

      // Act
      const error = await client
        .get('https://api.example.com/users')
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBe(replacement);
      expect((error as ValifetchError).code).toBe('VALIDATION_ERROR');
    });

    it('should run for request validation errors thrown while building the request', async () => {
      // Arrange
      const received: ValifetchError[] = [];
      const client = valifetch.create({
        hooks: {
          beforeError: [
            (error) => {
              received.push(error);
              return error;
            },
          ],
        },
      });

      // Act
      const error = await client
        .post('https://api.example.com/users', {
          json: { name: 123 },
          bodySchema: v.object({ name: v.string() }),
        })
        .catch((e: unknown) => e);

      // Assert
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(received).toHaveLength(1);
      expect((error as ValifetchError).code).toBe('VALIDATION_ERROR');
    });

    it('should run for network errors', async () => {
      // Arrange
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
      const received: ValifetchError[] = [];
      const client = valifetch.create({
        retry: false,
        hooks: {
          beforeError: [
            (error) => {
              received.push(error);
              return error;
            },
          ],
        },
      });

      // Act
      await client.get('https://api.example.com/users').catch(() => undefined);

      // Assert
      expect(received[0]?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('when the pipeline throws a non-ValifetchError', () => {
    it('should rethrow the original value without calling the hook', async () => {
      // Arrange
      const thrown = new Error('hook exploded');
      const beforeError = vi.fn<BeforeErrorHook>((error) => error);
      const client = valifetch.create({
        hooks: {
          beforeRequest: [
            () => {
              throw thrown;
            },
          ],
          beforeError: [beforeError],
        },
      });

      // Act
      const error = await client
        .get('https://api.example.com/users')
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBe(thrown);
      expect(beforeError).not.toHaveBeenCalled();
    });
  });

  describe('hook merging', () => {
    it('should run instance hooks before per-request hooks', async () => {
      // Arrange
      mockStatus(500);
      const calls: string[] = [];
      const track =
        (name: string): BeforeErrorHook =>
        (error) => {
          calls.push(name);
          return error;
        };
      const client = valifetch.create({
        retry: false,
        hooks: { beforeError: [track('instance')] },
      });

      // Act
      await client
        .get('https://api.example.com/users', {
          hooks: { beforeError: [track('request')] },
        })
        .catch(() => undefined);

      // Assert
      expect(calls).toEqual(['instance', 'request']);
    });

    it('should run parent hooks before extended child hooks', async () => {
      // Arrange
      mockStatus(500);
      const calls: string[] = [];
      const track =
        (name: string): BeforeErrorHook =>
        (error) => {
          calls.push(name);
          return error;
        };
      const parent = valifetch.create({
        retry: false,
        hooks: { beforeError: [track('parent')] },
      });
      const child = parent.extend({ hooks: { beforeError: [track('child')] } });

      // Act
      await child.get('https://api.example.com/users').catch(() => undefined);

      // Assert
      expect(calls).toEqual(['parent', 'child']);
    });

    it('should keep the original error when a hook returns nothing', async () => {
      // Arrange
      mockStatus(500);
      // A JS caller can omit the return even though the type requires it
      const forgetful = (() => undefined) as unknown as BeforeErrorHook;

      // Act
      const error = await valifetch
        .get('https://api.example.com/users', {
          retry: false,
          hooks: { beforeError: [forgetful] },
        })
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('HTTP_ERROR');
    });

    it('should leave the error untouched when no hooks are registered', async () => {
      // Arrange
      mockStatus(500);

      // Act
      const error = await valifetch
        .get('https://api.example.com/users', { retry: false })
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(ValifetchError);
      expect((error as ValifetchError).code).toBe('HTTP_ERROR');
    });
  });
});
