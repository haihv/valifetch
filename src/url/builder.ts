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
    appendSearchParams(url, searchParams);
  }

  return url;
}

/**
 * Append search params to URL from various formats
 */
function appendSearchParams(url: URL, params: SearchParamsInit): void {
  if (typeof params === 'string') {
    // Parse string as URLSearchParams
    new URLSearchParams(params).forEach((v, k) =>
      url.searchParams.append(k, v)
    );
  } else if (params instanceof URLSearchParams) {
    // Copy from URLSearchParams
    params.forEach((v, k) => url.searchParams.append(k, v));
  } else if (Array.isArray(params)) {
    // Array of [key, value] tuples
    for (const [k, v] of params) {
      if (v !== undefined && v !== null) {
        url.searchParams.append(k, String(v));
      }
    }
  } else {
    // Record object
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.append(k, String(v));
      }
    }
  }
}
