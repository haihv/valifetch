/**
 * Replace :param placeholders in URL with actual values
 */
export function replacePathParams(
  path: string,
  params: Record<string, string | number>
): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, paramName: string) => {
    if (!(paramName in params)) {
      throw new Error(`Missing required path parameter: ${paramName}`);
    }
    const value = params[paramName];
    if (value === undefined || value === null) {
      throw new Error(`Path parameter "${paramName}" cannot be null or undefined`);
    }
    return encodeURIComponent(String(value));
  });
}

/**
 * Extract param names from path for validation
 */
export function extractParamNames(path: string): string[] {
  const matches = path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

/**
 * Check if path has any parameters
 */
export function hasPathParams(path: string): boolean {
  return /:([a-zA-Z_][a-zA-Z0-9_]*)/.test(path);
}
