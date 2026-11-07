let cached: boolean | undefined;

/**
 * Whether the runtime can send a `ReadableStream` as a request body.
 *
 * Uses the standard probe: a supporting engine reads `duplex` and infers no
 * `Content-Type`. Engines that stringify the stream (Firefox, old Chromium)
 * infer `text/plain`; engines that keep the stream but never read `duplex`
 * (older Safari) reject it later in `fetch`. Deno is the exception: it never
 * reads `duplex` yet streams request bodies, so it is recognised explicitly.
 * Evaluated lazily and cached. Internal — not re-exported from the package
 * entry point.
 */
export function supportsRequestStreams(): boolean {
  if (cached === undefined) {
    let duplexAccessed = false;
    const init = {
      method: 'POST',
      body: new ReadableStream(),
      get duplex() {
        duplexAccessed = true;
        return 'half';
      },
    };
    const hasContentType = new Request(
      'https://valifetch.invalid',
      init as RequestInit
    ).headers.has('Content-Type');
    const isDeno = typeof (globalThis as { Deno?: unknown }).Deno === 'object';
    cached = !hasContentType && (duplexAccessed || isDeno);
  }
  return cached;
}

/** Clears the cached probe result. Test seam only. */
export function resetRequestStreamSupportCache(): void {
  cached = undefined;
}
