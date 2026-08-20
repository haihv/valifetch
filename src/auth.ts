/**
 * Built-in `beforeRequest` hook factories for common authentication patterns.
 *
 * Import from the `valifetch/auth` subpath so the auth code is tree-shaken
 * out of bundles that don't use it.
 *
 * @example
 * ```ts
 * import valifetch from 'valifetch';
 * import { bearerAuth, basicAuth, jwtRefresh } from 'valifetch/auth';
 *
 * const api = valifetch.create({
 *   hooks: {
 *     beforeRequest: [bearerAuth(() => localStorage.getItem('token'))],
 *   },
 * });
 * ```
 *
 * @module
 */

import type { BeforeRequestHook } from './types/hooks';

/**
 * Options for the {@link jwtRefresh} hook factory.
 */
export type JwtRefreshOptions = {
  /** Returns the current access token, or `null`/`undefined` if not yet set. */
  getToken: () => string | null | undefined;
  /**
   * Returns `true` when the token must be refreshed before the next request.
   * Called only when `getToken()` returns a non-null value.
   */
  isExpired: (token: string) => boolean;
  /**
   * Fetches a fresh access token from the auth server.
   * Called at most once per concurrent refresh window — all queued requests
   * share the same in-flight refresh promise.
   */
  refresh: () => Promise<string>;
  /**
   * Persists the new token after a successful refresh (e.g. update a store).
   * Optional; may be synchronous or return a `Promise` — when it returns a
   * promise, the hook awaits it before attaching the refreshed token.
   */
  onRefreshed?: (token: string) => void | Promise<void>;
};

/**
 * Returns a `beforeRequest` hook that adds an `Authorization: Bearer <token>`
 * header before every request.
 *
 * If `getToken()` returns `null` or `undefined` the header is left unset,
 * allowing unauthenticated requests to pass through.
 *
 * @param getToken - Synchronous getter for the current access token.
 * @returns A `beforeRequest` hook that sets the `Authorization` header.
 *
 * @example
 * ```ts
 * import valifetch from 'valifetch';
 * import { bearerAuth } from 'valifetch/auth';
 *
 * const api = valifetch.create({
 *   hooks: { beforeRequest: [bearerAuth(() => localStorage.getItem('token'))] },
 * });
 * ```
 */
export function bearerAuth(
  getToken: () => string | null | undefined
): BeforeRequestHook {
  return (request) => {
    const token = getToken();
    if (token != null) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
  };
}

/**
 * Encodes a string to base64 via UTF-8 bytes rather than `btoa` directly —
 * `btoa` only accepts Latin-1 code points and throws on wider Unicode input
 * (e.g. `é`, `中`), which is a real risk in credential strings.
 */
function toBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Returns a `beforeRequest` hook that adds an `Authorization: Basic <credentials>`
 * header before every request. Credentials are encoded once at creation time.
 *
 * The `user:pass` string is UTF-8 encoded before base64 (not `btoa` directly,
 * which only supports Latin-1), so non-ASCII usernames/passwords are safe.
 *
 * @param user - The username (must not contain a colon).
 * @param pass - The password.
 * @returns A `beforeRequest` hook that sets the `Authorization` header.
 *
 * @example
 * ```ts
 * import valifetch from 'valifetch';
 * import { basicAuth } from 'valifetch/auth';
 *
 * const api = valifetch.create({
 *   hooks: { beforeRequest: [basicAuth('admin', 's3cr3t')] },
 * });
 * ```
 */
export function basicAuth(user: string, pass: string): BeforeRequestHook {
  const encoded = toBase64Utf8(`${user}:${pass}`);
  return (request) => {
    request.headers.set('Authorization', `Basic ${encoded}`);
  };
}

/**
 * Returns a `beforeRequest` hook that proactively refreshes a JWT access token
 * when it is expired before attaching it as `Authorization: Bearer <token>`.
 *
 * Concurrent requests that arrive while a refresh is already in flight are
 * queued — only **one** refresh call is made, and all waiting requests receive
 * the same new token once it resolves.
 *
 * @param opts - Configuration for token retrieval, expiry check, and refresh.
 * @returns A `beforeRequest` hook that refreshes and attaches the token as needed.
 *
 * @example
 * ```ts
 * import valifetch from 'valifetch';
 * import { jwtRefresh } from 'valifetch/auth';
 *
 * const api = valifetch.create({
 *   hooks: {
 *     beforeRequest: [
 *       jwtRefresh({
 *         getToken: () => store.accessToken,
 *         isExpired: (token) => isJwtExpired(token),
 *         refresh: () => authApi.post('/refresh').then((r) => r.token),
 *         onRefreshed: (token) => store.setToken(token),
 *       }),
 *     ],
 *   },
 * });
 * ```
 */
export function jwtRefresh(opts: JwtRefreshOptions): BeforeRequestHook {
  let refreshPromise: Promise<string> | null = null;

  return async (request) => {
    const token = opts.getToken();

    if (token != null && !opts.isExpired(token)) {
      request.headers.set('Authorization', `Bearer ${token}`);
      return;
    }

    if (!refreshPromise) {
      refreshPromise = opts
        .refresh()
        .then(async (newToken) => {
          await opts.onRefreshed?.(newToken);
          return newToken;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const newToken = await refreshPromise;
    request.headers.set('Authorization', `Bearer ${newToken}`);
  };
}
