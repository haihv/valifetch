let cached: boolean | undefined;

/**
 * Whether the runtime can send a `ReadableStream` as a request body.
 *
 * Engines without support (Firefox) ignore `duplex` and stringify the stream
 * into a `text/plain` body, so the standard probe checks that `duplex` is read
 * and that no `Content-Type` was inferred. Evaluated lazily and cached.
 * Internal — not re-exported from the package entry point.
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
    cached = duplexAccessed && !hasContentType;
  }
  return cached;
}

/** Clears the cached probe result. Test seam only. */
export function resetRequestStreamSupportCache(): void {
  cached = undefined;
}
