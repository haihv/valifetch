import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { valifetch } from '../../src/core/valifetch';
import { createMock } from '../../src/mock/index';

const BASE = 'https://api.example.com';

describe('createMock', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"fallthrough":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ── HTTP method shorthands ───────────────────────────────────────────────

  it('intercepts GET via mock.get()', async () => {
    const mock = createMock();
    mock.get('/users').reply(200, [{ id: 1 }]);
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.get(`${BASE}/users`);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('intercepts POST via mock.post()', async () => {
    const mock = createMock();
    mock.post('/users').reply(201, { id: 2 });
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.post(`${BASE}/users`, { json: { name: 'Bob' } });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 2 });
  });

  it('intercepts PUT via mock.put()', async () => {
    const mock = createMock();
    mock.put('/users/1').reply(200, { id: 1, name: 'Updated' });
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.put(`${BASE}/users/1`, {
      json: { name: 'Updated' },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 1, name: 'Updated' });
  });

  it('intercepts PATCH via mock.patch()', async () => {
    const mock = createMock();
    mock.patch('/users/1').reply(200, { patched: true });
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.patch(`${BASE}/users/1`, { json: { name: 'x' } });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ patched: true });
  });

  it('intercepts DELETE via mock.delete()', async () => {
    const mock = createMock();
    mock.delete('/users/1').reply(200, { deleted: true });
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.delete(`${BASE}/users/1`);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: true });
  });

  it('intercepts HEAD via mock.head()', async () => {
    const mock = createMock();
    mock.head('/users').reply(200, null);
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.head(`${BASE}/users`);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mock.calls()).toHaveLength(1);
    expect(mock.calls()[0].method).toBe('HEAD');
  });

  it('intercepts OPTIONS via mock.options()', async () => {
    const mock = createMock();
    mock.options('/users').reply(200, null);
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.options(`${BASE}/users`);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mock.calls()[0].method).toBe('OPTIONS');
  });

  // ── mock.when() ─────────────────────────────────────────────────────────

  it('intercepts any method via mock.when("*", pattern)', async () => {
    const mock = createMock();
    mock.when('*', '/ping').reply(200, 'pong');
    const api = valifetch.extend({ hooks: mock.hooks });

    const [r1, r2] = await Promise.all([
      api.get(`${BASE}/ping`),
      api.post(`${BASE}/ping`),
    ]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r1).toBe('pong');
    expect(r2).toBe('pong');
  });

  it('uses mock.when() for specific method', async () => {
    const mock = createMock();
    mock.when('DELETE', '/items/5').reply(200, { deleted: true });
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.delete(`${BASE}/items/5`);

    expect(result).toEqual({ deleted: true });
  });

  // ── URL pattern matching ────────────────────────────────────────────────

  it('matches :param wildcards in path', async () => {
    const mock = createMock();
    mock.get('/users/:id').reply(200, { found: true });
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.get(`${BASE}/users/42`);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ found: true });
  });

  it('matches * wildcard in path', async () => {
    const mock = createMock();
    mock.get('/files/*').reply(200, { file: true });
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.get(`${BASE}/files/a/b/c.txt`);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ file: true });
  });

  it('matches RegExp pattern against full URL', async () => {
    const mock = createMock();
    mock.get(/\/posts\/\d+$/).reply(200, { post: true });
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.get(`${BASE}/posts/99`);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ post: true });
  });

  it('falls through to real fetch when no route matches', async () => {
    const mock = createMock();
    mock.get('/known').reply(200, {});
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.get(`${BASE}/unknown`);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls through when all replyOnce responses are consumed', async () => {
    const mock = createMock();
    mock.get('/endpoint').replyOnce(200, { first: true });
    const api = valifetch.extend({ hooks: mock.hooks });

    const first = await api.get(`${BASE}/endpoint`);
    expect(first).toEqual({ first: true });

    // Second call: no responses left → real fetch
    await api.get(`${BASE}/endpoint`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ── reply / replyOnce chaining ──────────────────────────────────────────

  it('queues responses and consumes replyOnce first', async () => {
    const mock = createMock();
    mock.get('/q').replyOnce(500, { error: 'boom' }).reply(200, { ok: true });
    const api = valifetch.extend({ hooks: mock.hooks });

    const first = await api.get(`${BASE}/q`, { throwHttpErrors: false });
    const second = await api.get(`${BASE}/q`);
    const third = await api.get(`${BASE}/q`);

    expect(first).toEqual({ error: 'boom' });
    expect(second).toEqual({ ok: true });
    expect(third).toEqual({ ok: true }); // permanent reply reused
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('queues multiple replyOnce responses in order', async () => {
    const mock = createMock();
    mock.post('/items').replyOnce(201, { id: 1 }).replyOnce(201, { id: 2 });
    const api = valifetch.extend({ hooks: mock.hooks });

    const r1 = await api.post(`${BASE}/items`, { json: {} });
    const r2 = await api.post(`${BASE}/items`, { json: {} });

    expect(r1).toEqual({ id: 1 });
    expect(r2).toEqual({ id: 2 });
    // Third call: no responses left → real fetch
    await api.post(`${BASE}/items`, { json: {} });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ── calls() / lastCall() ────────────────────────────────────────────────

  it('records calls in order', async () => {
    const mock = createMock();
    mock.get('/a').reply(200, { label: 'a' });
    mock.post('/b').reply(201, { label: 'b' });
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.get(`${BASE}/a`);
    await api.post(`${BASE}/b`, { json: {} });

    const calls = mock.calls();
    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(`${BASE}/a`);
    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toBe(`${BASE}/b`);
  });

  it('calls() returns a snapshot (not live reference)', async () => {
    const mock = createMock();
    mock.get('/x').reply(200, {});
    const api = valifetch.extend({ hooks: mock.hooks });

    const snapshot = mock.calls();
    await api.get(`${BASE}/x`);

    expect(snapshot).toHaveLength(0); // snapshot taken before request
    expect(mock.calls()).toHaveLength(1);
  });

  it('lastCall() returns undefined when no calls recorded', () => {
    const mock = createMock();
    expect(mock.lastCall()).toBeUndefined();
  });

  it('lastCall() returns the most recent call', async () => {
    const mock = createMock();
    mock.get('/r1').reply(200, {});
    mock.get('/r2').reply(200, {});
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.get(`${BASE}/r1`);
    await api.get(`${BASE}/r2`);

    expect(mock.lastCall()?.url).toBe(`${BASE}/r2`);
  });

  // ── recorded call fields ────────────────────────────────────────────────

  it('records headers from the intercepted request', async () => {
    const mock = createMock();
    mock.get('/secure').reply(200, {});
    const api = valifetch.extend({
      headers: { Authorization: 'Bearer tok' },
      hooks: mock.hooks,
    });

    await api.get(`${BASE}/secure`);

    const call = mock.lastCall()!;
    expect(call.headers['authorization']).toBe('Bearer tok');
  });

  it('records JSON body', async () => {
    const mock = createMock();
    mock.post('/body-json').reply(201, {});
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.post(`${BASE}/body-json`, { json: { name: 'Alice', age: 30 } });

    const call = mock.lastCall()!;
    expect(call.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('records text body when request has no content-type header', async () => {
    const mock = createMock();
    mock.post('/no-ct').reply(200, {});
    const hook = mock.hooks.beforeRequest[0];
    const request = new Request(`${BASE}/no-ct`, {
      method: 'POST',
      body: 'raw body',
      // no Content-Type header → get('content-type') returns null → ?? '' → text branch
    });
    await hook(request, {} as never);

    expect(mock.lastCall()?.body).toBe('raw body');
  });

  it('records text body for non-JSON content-type', async () => {
    const mock = createMock();
    mock.post('/body-text').reply(200, null);

    // Call the hook directly with a text body to test the non-JSON branch
    const hook = mock.hooks.beforeRequest[0];
    const request = new Request(`${BASE}/body-text`, {
      method: 'POST',
      body: 'hello world',
      headers: { 'Content-Type': 'text/plain' },
    });
    await hook(request, {} as never);

    expect(mock.lastCall()?.body).toBe('hello world');
  });

  it('records null body for bodyless requests', async () => {
    const mock = createMock();
    mock.get('/nobody').reply(200, {});
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.get(`${BASE}/nobody`);

    // GET has no request body
    expect(mock.lastCall()?.body).toBeNull();
  });

  it('records searchParams', async () => {
    const mock = createMock();
    mock.get('/search').reply(200, []);
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.get(`${BASE}/search`, {
      searchParams: { q: 'hello', page: '2' },
    });

    const { searchParams } = mock.lastCall()!;
    expect(searchParams.get('q')).toBe('hello');
    expect(searchParams.get('page')).toBe('2');
  });

  // ── fixture response ─────────────────────────────────────────────────────

  it('sends object body as JSON with content-type header', async () => {
    const mock = createMock();
    mock.get('/typed').reply(200, { value: 42 });
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.get(`${BASE}/typed`);

    expect(result).toEqual({ value: 42 });
  });

  it('sends string body JSON-serialised so valifetch parses it correctly', async () => {
    const mock = createMock();
    // 'hello' → JSON.stringify → '"hello"' → valifetch JSON-parses → 'hello'
    mock.get('/text').reply(200, 'hello');
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = await api.get(`${BASE}/text`);

    expect(result).toBe('hello');
  });

  it('preserves pre-set content-type header in fixture response', async () => {
    const mock = createMock();
    // custom content-type is passed; the default 'application/json' should not override it
    mock
      .get('/custom-ct')
      .reply(
        200,
        { ok: true },
        { 'Content-Type': 'application/json; charset=utf-8' }
      );
    const api = valifetch.extend({ hooks: mock.hooks });

    const result = (await api.get(`${BASE}/custom-ct`, {
      responseType: 'raw',
    })) as Response;

    expect(result.headers.get('content-type')).toBe(
      'application/json; charset=utf-8'
    );
  });

  it('fixture with undefined body sends a bodyless response', async () => {
    const mock = createMock();
    mock.get('/empty').reply(204); // no body arg → undefined → bodyless
    const hook = mock.hooks.beforeRequest[0];
    const request = new Request(`${BASE}/empty`, { method: 'GET' });

    const response = (await hook(request, {} as never)) as Response;

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('null-body status codes (204, 304) ignore any body argument', async () => {
    const mock = createMock();
    // body is provided but must be dropped for null-body statuses
    mock.get('/no-content').reply(204, { ignored: true });
    const hook = mock.hooks.beforeRequest[0];
    const request = new Request(`${BASE}/no-content`, { method: 'GET' });

    const response = (await hook(request, {} as never)) as Response;

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  // ── reset() ──────────────────────────────────────────────────────────────

  it('reset() clears recorded calls', async () => {
    const mock = createMock();
    mock.get('/r').reply(200, {});
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.get(`${BASE}/r`);
    expect(mock.calls()).toHaveLength(1);

    mock.reset();

    expect(mock.calls()).toHaveLength(0);
    expect(mock.lastCall()).toBeUndefined();
  });

  it('reset() clears registered handlers', async () => {
    const mock = createMock();
    mock.get('/gone').reply(200, { was: 'here' });
    const api = valifetch.extend({ hooks: mock.hooks });

    mock.reset();

    // After reset the route is gone → real fetch
    await api.get(`${BASE}/gone`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ── method isolation ──────────────────────────────────────────────────────

  it('does not match wrong method', async () => {
    const mock = createMock();
    mock.post('/only-post').reply(201, { ok: true });
    const api = valifetch.extend({ hooks: mock.hooks });

    // GET on a POST-only route → falls through
    await api.get(`${BASE}/only-post`);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mock.calls()).toHaveLength(0);
  });

  it('does not match wrong path', async () => {
    const mock = createMock();
    mock.get('/alpha').reply(200, {});
    const api = valifetch.extend({ hooks: mock.hooks });

    await api.get(`${BASE}/beta`);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mock.calls()).toHaveLength(0);
  });
});
