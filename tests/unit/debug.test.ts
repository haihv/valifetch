import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { valifetch } from '../../src/core/valifetch';
import type { DebugEvent } from '../../src/types';

const BASE = 'https://api.example.com';

describe('debug option', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ── debug: true ─────────────────────────────────────────────────────────

  it('debug: true emits request and response events via console.debug', async () => {
    const consoleSpy = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    const api = valifetch.extend({ debug: true });

    await api.get(`${BASE}/users`);

    const calls = consoleSpy.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0][0]).toBe('[valifetch]');
    expect(calls[0][1]).toMatchObject({ type: 'request' });
    expect(calls[1][0]).toBe('[valifetch]');
    expect(calls[1][1]).toMatchObject({ type: 'response', attempt: 1 });

    consoleSpy.mockRestore();
  });

  // ── debug: function ──────────────────────────────────────────────────────

  it('debug function receives request and response events in order', async () => {
    const events: DebugEvent[] = [];
    const api = valifetch.extend({ debug: (e) => events.push(e) });

    await api.get(`${BASE}/users`);

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('request');
    expect(events[1].type).toBe('response');
  });

  it('response event carries correct attempt number (1 on first attempt)', async () => {
    const events: DebugEvent[] = [];
    const api = valifetch.extend({ debug: (e) => events.push(e) });

    await api.get(`${BASE}/users`);

    const responseEvent = events.find((e) => e.type === 'response');
    expect(responseEvent).toMatchObject({ type: 'response', attempt: 1 });
  });

  it('request event carries the outgoing Request object', async () => {
    const events: DebugEvent[] = [];
    const api = valifetch.extend({ debug: (e) => events.push(e) });

    await api.get(`${BASE}/users`);

    const requestEvent = events.find((e) => e.type === 'request') as Extract<
      DebugEvent,
      { type: 'request' }
    >;
    expect(requestEvent.request).toBeInstanceOf(Request);
    expect(requestEvent.request.url).toBe(`${BASE}/users`);
  });

  it('response event carries the raw Response object', async () => {
    const events: DebugEvent[] = [];
    const api = valifetch.extend({ debug: (e) => events.push(e) });

    await api.get(`${BASE}/users`);

    const responseEvent = events.find((e) => e.type === 'response') as Extract<
      DebugEvent,
      { type: 'response' }
    >;
    expect(responseEvent.response).toBeInstanceOf(Response);
    expect(responseEvent.response.status).toBe(200);
  });

  // ── retry — status-based ─────────────────────────────────────────────────

  it('emits retry event with reason=status when server returns retryable status', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response('{"err":true}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const events: DebugEvent[] = [];
    const api = valifetch.extend({
      debug: (e) => events.push(e),
      retry: { limit: 1, delay: () => 0 },
    });

    await api.get(`${BASE}/users`);

    const retryEvent = events.find((e) => e.type === 'retry') as Extract<
      DebugEvent,
      { type: 'retry' }
    >;
    expect(retryEvent).toBeDefined();
    expect(retryEvent.reason).toBe('status');
    expect(typeof retryEvent.delay).toBe('number');
    // attempt is 1-based: value 1 means the first attempt just failed
    expect(retryEvent.attempt).toBe(1);
  });

  it('emits request event once per attempt (initial + retry)', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const events: DebugEvent[] = [];
    const api = valifetch.extend({
      debug: (e) => events.push(e),
      retry: { limit: 1, delay: () => 0 },
    });

    await api.get(`${BASE}/users`);

    const requestEvents = events.filter((e) => e.type === 'request');
    expect(requestEvents).toHaveLength(2);
  });

  // ── retry — network-based ────────────────────────────────────────────────

  it('emits retry event with reason=network when fetch rejects', async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const events: DebugEvent[] = [];
    const api = valifetch.extend({
      debug: (e) => events.push(e),
      retry: { limit: 1, delay: () => 0 },
    });

    await api.get(`${BASE}/users`);

    const retryEvent = events.find((e) => e.type === 'retry') as Extract<
      DebugEvent,
      { type: 'retry' }
    >;
    expect(retryEvent).toBeDefined();
    expect(retryEvent.reason).toBe('network');
  });

  // ── cancel ───────────────────────────────────────────────────────────────

  it('emits cancel event when request is aborted via .cancel()', async () => {
    fetchSpy.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    const events: DebugEvent[] = [];
    const api = valifetch.extend({
      debug: (e) => events.push(e),
      retry: false,
    });

    const req = api.get(`${BASE}/slow`);
    req.cancel();

    await req.catch(() => undefined);

    const cancelEvent = events.find((e) => e.type === 'cancel');
    expect(cancelEvent).toBeDefined();
  });

  it('cancel event carries the in-flight request (cloned on retries)', async () => {
    // First call: network error triggers a retry.
    // Second call (the retry clone): hangs until aborted by .cancel().
    fetchSpy
      .mockRejectedValueOnce(new Error('Network error'))
      .mockImplementationOnce(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal as AbortSignal | undefined;
            if (signal?.aborted) {
              reject(new DOMException('Aborted', 'AbortError'));
              return;
            }
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      );

    const events: DebugEvent[] = [];
    const api = valifetch.extend({
      debug: (e) => events.push(e),
      retry: { limit: 1, delay: () => 0 },
    });

    const req = api.get(`${BASE}/slow`);
    // Let the first attempt fail and the retry attempt start
    await new Promise((r) => setTimeout(r, 10));
    req.cancel();

    await req.catch(() => undefined);

    const cancelEvent = events.find((e) => e.type === 'cancel') as Extract<
      DebugEvent,
      { type: 'cancel' }
    >;
    expect(cancelEvent).toBeDefined();
    expect(cancelEvent.request.url).toBe(`${BASE}/slow`);
  });

  // ── hook-intercepted requests ────────────────────────────────────────────

  it('emits request and response events for hook-intercepted (mock) requests', async () => {
    const events: DebugEvent[] = [];
    const api = valifetch.extend({
      debug: (e) => events.push(e),
      hooks: {
        beforeRequest: [
          () =>
            new Response('{"intercepted":true}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
        ],
      },
    });

    await api.get(`${BASE}/users`);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({ type: 'request' });
    expect(events[1]).toMatchObject({ type: 'response', attempt: 1 });
  });

  // ── timeout does not emit cancel ──────────────────────────────────────────

  it('timeout does NOT emit a cancel event', async () => {
    vi.useFakeTimers();
    fetchSpy.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit)?.signal as
            | AbortSignal
            | undefined;
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );

    const events: DebugEvent[] = [];
    const api = valifetch.extend({
      debug: (e) => events.push(e),
      timeout: 100,
      retry: false,
    });

    const promise = api.get(`${BASE}/slow`).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(200);
    await promise;
    vi.useRealTimers();

    const cancelEvents = events.filter((e) => e.type === 'cancel');
    expect(cancelEvents).toHaveLength(0);
  });

  // ── no debug ─────────────────────────────────────────────────────────────

  it('no events are emitted when debug is undefined', async () => {
    const consoleSpy = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);

    await valifetch.get(`${BASE}/users`);

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  // ── instance-level and extend inheritance ────────────────────────────────

  it('instance-level debug fires for requests on that instance', async () => {
    const events: DebugEvent[] = [];
    const api = valifetch.create({ debug: (e) => events.push(e) });

    await api.get(`${BASE}/users`);

    expect(events.some((e) => e.type === 'request')).toBe(true);
  });

  it('child instance inherits debug from parent via extend', async () => {
    const events: DebugEvent[] = [];
    const parent = valifetch.create({ debug: (e) => events.push(e) });
    const child = parent.extend({ headers: { 'X-Test': 'yes' } });

    await child.get(`${BASE}/users`);

    expect(events.some((e) => e.type === 'request')).toBe(true);
  });

  it('child debug overrides parent debug', async () => {
    const parentEvents: DebugEvent[] = [];
    const childEvents: DebugEvent[] = [];

    const parent = valifetch.create({ debug: (e) => parentEvents.push(e) });
    const child = parent.extend({ debug: (e) => childEvents.push(e) });

    await child.get(`${BASE}/users`);

    expect(childEvents.length).toBeGreaterThan(0);
    expect(parentEvents).toHaveLength(0);
  });
});
