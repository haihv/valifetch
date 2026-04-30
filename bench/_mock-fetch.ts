/**
 * Override globalThis.fetch at module scope so bench iterations see the mock.
 * (beforeAll/afterAll run in a different context than tinybench iterations in Vitest 4.)
 */
export function mockFetch(body: unknown, status = 200): void {
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        statusText: status === 200 ? 'OK' : String(status),
        headers: { 'Content-Type': 'application/json' },
      })
    );
}
