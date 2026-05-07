import type { BeforeRequestHook, HttpMethod } from '../types';
import type { MockCall, MockHandler, ValifetchMock } from './types';

type MockResponseItem = {
  status: number;
  body?: unknown;
  headers?: HeadersInit;
  once: boolean;
};

type MockRoute = {
  method: HttpMethod | '*';
  pattern: string | RegExp;
  responses: MockResponseItem[];
};

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '[^/]+')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesUrl(requestUrl: string, pattern: string | RegExp): boolean {
  if (pattern instanceof RegExp) return pattern.test(requestUrl);
  const { pathname } = new URL(requestUrl);
  return patternToRegex(pattern).test(pathname);
}

async function parseRequestBody(request: Request): Promise<unknown> {
  if (!request.body) return null;
  const ct = request.headers.get('content-type');
  if (ct !== null && ct.includes('application/json')) {
    /* v8 ignore next 1 */
    try {
      return await request.clone().json();
    } catch {
      return null;
    }
  }
  /* v8 ignore next 1 */
  try {
    return await request.clone().text();
  } catch {
    return null;
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// Per the Fetch spec, these status codes must not carry a response body.
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function buildFixtureResponse(
  status: number,
  body?: unknown,
  headers?: HeadersInit
): Response {
  const responseHeaders = new Headers(headers);

  if (body === undefined || NULL_BODY_STATUSES.has(status)) {
    return new Response(null, { status, headers: responseHeaders });
  }

  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'application/json');
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

/**
 * Creates a valifetch mock for use in tests.
 *
 * Register fixture responses by URL pattern and HTTP method, then attach the mock
 * to a valifetch instance via `extend({ hooks: mock.hooks })`. Matched requests are
 * intercepted before reaching the network; unmatched requests fall through to the real `fetch`.
 *
 * @example
 * ```ts
 * import { createMock } from 'valifetch/mock';
 * import valifetch from 'valifetch';
 *
 * const mock = createMock();
 * mock.get('/users').reply(200, [{ id: 1, name: 'Alice' }]);
 * mock.post('/users').reply(201, { id: 2, name: 'Bob' });
 *
 * const api = valifetch.extend({ hooks: mock.hooks });
 *
 * const users = await api.get('https://api.example.com/users');
 * // assert(users[0].name === 'Alice')
 *
 * const call = mock.lastCall();
 * // assert(call?.method === 'GET')
 *
 * mock.reset(); // clear between tests
 * ```
 */
export function createMock(): ValifetchMock {
  const routes: MockRoute[] = [];
  const recorded: MockCall[] = [];

  function registerRoute(
    method: HttpMethod | '*',
    pattern: string | RegExp
  ): MockHandler {
    const route: MockRoute = { method, pattern, responses: [] };
    routes.push(route);
    const handler: MockHandler = {
      reply(status, body, headers) {
        route.responses.push({ status, body, headers, once: false });
        return handler;
      },
      replyOnce(status, body, headers) {
        route.responses.push({ status, body, headers, once: true });
        return handler;
      },
    };
    return handler;
  }

  const interceptHook: BeforeRequestHook = async (request) => {
    const { url, method } = request;

    const route = routes.find(
      (r) =>
        (r.method === '*' || r.method === method) &&
        matchesUrl(url, r.pattern) &&
        r.responses.length > 0
    );

    if (!route) return;

    // responses.length > 0 is guaranteed by the find condition above
    const responseItem = route.responses[0]!;
    if (responseItem.once) route.responses.shift();

    const body = await parseRequestBody(request);
    recorded.push({
      method,
      url,
      headers: headersToRecord(request.headers),
      body,
      searchParams: new URL(url).searchParams,
    });

    return buildFixtureResponse(
      responseItem.status,
      responseItem.body,
      responseItem.headers
    );
  };

  return {
    get: (pattern) => registerRoute('GET', pattern),
    post: (pattern) => registerRoute('POST', pattern),
    put: (pattern) => registerRoute('PUT', pattern),
    patch: (pattern) => registerRoute('PATCH', pattern),
    delete: (pattern) => registerRoute('DELETE', pattern),
    head: (pattern) => registerRoute('HEAD', pattern),
    options: (pattern) => registerRoute('OPTIONS', pattern),
    when: registerRoute,
    calls: () => [...recorded],
    lastCall: () => recorded[recorded.length - 1],
    reset() {
      routes.length = 0;
      recorded.length = 0;
    },
    hooks: { beforeRequest: [interceptHook] },
  };
}

export type { MockCall, MockHandler, ValifetchMock } from './types';
