let cached: boolean | undefined;

/**
 * Whether the runtime can send a `ReadableStream` as a request body.
 *
 * Engines without support (Firefox) stringify the stream into a body and
 * infer `Content-Type: text/plain;charset=UTF-8`, so the absence of an
 * inferred `Content-Type` is the signal. The common probe also requires the
 * engine to read `duplex`, but Deno never reads it while still streaming
 * request bodies, so that check would wrongly reject Deno. Evaluated lazily
 * and cached. Internal — not re-exported from the package entry point.
 */
export function supportsRequestStreams(): boolean {
  if (cached === undefined) {
    const init = {
      method: 'POST',
      body: new ReadableStream(),
      duplex: 'half',
    };
    cached = !new Request(
      'https://valifetch.invalid',
      init as RequestInit
    ).headers.has('Content-Type');
  }
  return cached;
}

/** Clears the cached probe result. Test seam only. */
export function resetRequestStreamSupportCache(): void {
  cached = undefined;
}
