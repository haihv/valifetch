import type { SearchParamsInit } from '../types';
import { replacePathParams } from './params';

/** Options for building a request URL */
export type BuildUrlOptions = {
  /** Base URL prefix prepended to the path */
  prefixUrl?: string;
  /** URL path, optionally containing `:param` segments */
  path: string;
  /** Path parameter values to interpolate into the path */
  params?: Record<string, string | number>;
  /** Query string parameters appended to the URL */
  searchParams?: SearchParamsInit;
};

/**
 * Build a URL from parts, handling path params and search params
 */
export function buildUrl(options: BuildUrlOptions): URL {
  const { prefixUrl, path, params, searchParams } = options;

  // Replace path params if provided
  const processedPath = params ? replacePathParams(path, params) : path;

  // Build full URL
  let url: URL;

  if (prefixUrl) {
    // Ensure proper joining of prefix and path
    const base = prefixUrl.endsWith('/') ? prefixUrl.slice(0, -1) : prefixUrl;
    const pathPart = processedPath.startsWith('/')
      ? processedPath
      : `/${processedPath}`;
    url = new URL(base + pathPart);
  } else {
    // Path must be absolute URL if no prefix
    url = new URL(processedPath);
  }

  // Add search params
  if (searchParams) {
    appendSearchParams(url.searchParams, searchParams);
  }

  return url;
}

/**
 * Append search params to a `URLSearchParams` target from various formats
 */
function appendSearchParams(
  target: URLSearchParams,
  params: SearchParamsInit
): void {
  if (typeof params === 'string') {
    // Parse string as URLSearchParams
    new URLSearchParams(params).forEach((v, k) => target.append(k, v));
  } else if (params instanceof URLSearchParams) {
    // Copy from URLSearchParams
    params.forEach((v, k) => target.append(k, v));
  } else if (Array.isArray(params)) {
    // Array of [key, value] tuples
    for (const [k, v] of params) {
      if (v !== undefined && v !== null) {
        target.append(k, String(v));
      }
    }
  } else {
    // Record object
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        target.append(k, String(v));
      }
    }
  }
}

/**
 * Collect keys explicitly set to `null`/`undefined` in a record or tuple-array
 * `SearchParamsInit`. Strings and `URLSearchParams` can't represent a nullish
 * value, so they never contribute keys here.
 */
function collectNullishKeys(params: SearchParamsInit): Set<string> {
  const keys = new Set<string>();
  if (Array.isArray(params)) {
    for (const [k, v] of params) {
      if (v === undefined || v === null) keys.add(k);
    }
  } else if (
    !(typeof params === 'string' || params instanceof URLSearchParams)
  ) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) keys.add(k);
    }
  }
  return keys;
}

/**
 * Merge instance-level search params with request-level ones.
 * Instance params act as defaults; every key present in the request params
 * replaces all instance entries for that key. A request key explicitly set to
 * `undefined`/`null` removes the instance default for that key entirely
 * rather than leaving it in place.
 * @param instanceParams - Search params configured on the instance
 * @param requestParams - Search params passed with the request
 * @returns The merged params, or `undefined` when neither side has any
 */
export function mergeSearchParams(
  instanceParams: SearchParamsInit | undefined,
  requestParams: SearchParamsInit | undefined
): SearchParamsInit | undefined {
  if (instanceParams === undefined) return requestParams;
  if (requestParams === undefined) return instanceParams;

  const merged = new URLSearchParams();
  appendSearchParams(merged, instanceParams);

  const overrides = new URLSearchParams();
  appendSearchParams(overrides, requestParams);

  const deletedKeys = new Set([
    ...overrides.keys(),
    ...collectNullishKeys(requestParams),
  ]);
  for (const key of deletedKeys) merged.delete(key);
  for (const [key, value] of overrides) merged.append(key, value);

  return merged;
}
