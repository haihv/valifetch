// Lookup table is faster than multiple boolean comparisons
const VALID_PARAM_CHAR = new Uint8Array(128);
for (let code = 97; code <= 122; code++) VALID_PARAM_CHAR[code] = 1; // a-z
for (let code = 65; code <= 90; code++) VALID_PARAM_CHAR[code] = 1; // A-Z
for (let code = 48; code <= 57; code++) VALID_PARAM_CHAR[code] = 1; // 0-9
VALID_PARAM_CHAR[95] = 1; // _

export function replacePathParams(
  path: string,
  params: Record<string, string | number>
): string {
  if (path.indexOf(':') === -1) return path;

  const pathLength = path.length;
  let result = '';
  let position = 0;

  while (position < pathLength) {
    const colonPosition = path.indexOf(':', position);

    if (colonPosition === -1) {
      return result + path.slice(position);
    }

    let nameEnd = colonPosition + 1;
    while (nameEnd < pathLength && VALID_PARAM_CHAR[path.charCodeAt(nameEnd)]) {
      nameEnd++;
    }

    const paramName = path.slice(colonPosition + 1, nameEnd);

    if (paramName.length === 0) {
      result += path.slice(position, colonPosition + 1);
      position = colonPosition + 1;
      continue;
    }

    if (!(paramName in params)) {
      throw new Error(`Missing required path parameter: ${paramName}`);
    }

    const value = params[paramName];
    if (value === undefined || value === null) {
      throw new Error(
        `Path parameter "${paramName}" cannot be null or undefined`
      );
    }

    // Avoid unnecessary String() call
    const encoded = encodeURIComponent(
      typeof value === 'string' ? value : String(value)
    );
    result += path.slice(position, colonPosition) + encoded;
    position = nameEnd;
  }

  return result;
}

export function extractParamNames(path: string): string[] {
  if (path.indexOf(':') === -1) return [];

  const names: string[] = [];
  const pathLength = path.length;
  let position = 0;

  while (position < pathLength) {
    const colonPosition = path.indexOf(':', position);
    if (colonPosition === -1) break;

    let nameEnd = colonPosition + 1;
    while (nameEnd < pathLength && VALID_PARAM_CHAR[path.charCodeAt(nameEnd)]) {
      nameEnd++;
    }

    if (nameEnd > colonPosition + 1) {
      names.push(path.slice(colonPosition + 1, nameEnd));
    }
    position = nameEnd;
  }

  return names;
}

export function hasPathParams(path: string): boolean {
  const colonPosition = path.indexOf(':');
  if (colonPosition === -1) return false;

  // Param names can't start with digit
  const nextChar = path.charCodeAt(colonPosition + 1);
  return (
    (nextChar >= 97 && nextChar <= 122) || // a-z
    (nextChar >= 65 && nextChar <= 90) || // A-Z
    nextChar === 95 // _
  );
}
