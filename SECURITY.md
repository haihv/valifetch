# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes |
| 0.x     | No. Upgrade to the latest 1.x |

As of the 1.0.0 release, 0.x (including 0.8.x) no longer receives fixes. Security fixes ship in a
new 1.x release.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub's private vulnerability reporting: go to
<https://github.com/haihv/valifetch/security/advisories/new> (repository **Security** tab →
**Report a vulnerability**). Include:

- the valifetch version and runtime (Node, Deno, Bun, browser),
- a minimal reproduction,
- the impact you expect (what an attacker controls and what they gain).

You should get an acknowledgement within a few days. Once a fix is ready we publish a GitHub
Security Advisory and credit you, unless you ask us not to.

## Threat model

valifetch is a thin client over the platform `fetch`. It assumes **your code is trusted**: you
choose the instance options, hooks and the URLs you call. **Responses and any values you forward
from your own users are untrusted.**

### What valifetch guarantees

- **Prefix containment.** With `prefixUrl` set, the final URL always keeps the prefix origin, and its
  path stays under the prefix path. Inputs like `https://evil.com`, `//evil.com`, `\\evil.com` or
  `http:evil.com` become path segments under the prefix, not a new host. A path that climbs above
  the prefix with `..` (including the encoded forms `%2e%2e`, `.%2E` and `%2E.`) throws a
  `TypeError` before any request is sent. A `prefixUrl` containing a query string or fragment
  (`?` or `#`) also throws a `TypeError`, so a path can never be swallowed into the prefix query;
  that error message does not echo the URL.
- **Path-param encoding.** `params` values are encoded with `encodeURIComponent`, so `/`, `?`, `#`,
  `\` and `%` inside a value cannot add path segments, a query string, a fragment or a host. The
  values `.` and `..` cannot be encoded safely (URL parsers resolve dot segments), so they throw a
  `TypeError`. Params are read as own properties only, so a template such as `:constructor` never
  resolves from `Object.prototype`.
- **Search-param encoding.** `searchParams` values go through `URLSearchParams`, so `&`, `=` and
  `#` in a value cannot add parameters or a fragment.
- **No header injection.** Header names and values containing CR, LF or NUL are rejected by the
  platform `Headers` class. This applies to the `headers` option, merged instance headers and the
  `bearerAuth` / `jwtRefresh` tokens, and the request rejects with a `TypeError` before it is
  sent. `basicAuth` base64-encodes its credentials, so they cannot split a header.
- **Prototype-pollution-safe option merging.** `create()` / `extend()` merging assigns user-supplied
  keys as own data properties. A JSON-derived `__proto__` key in options or headers cannot change
  any object's prototype or `Object.prototype`. valifetch never deep-merges user objects. The
  `valifetch/mock` call recorder keeps a `__proto__` request header as a plain own key too.
- **No secrets in built-in logs.** `debug: true` logs a summary rather than the raw
  `Request`/`Response`. It replaces with `[REDACTED]` the value of any header, and of any URL query
  parameter, whose name contains (case-insensitive) `auth`, `cookie`, `token`, `secret`, `key`,
  `session`, `pass`, `credential`, `sig`, `jwt`, `dpop`, `csrf`, `xsrf`, `otp`, `bearer` or
  `code`. This covers `Authorization`, cookies, API keys, `?access_token=`, presigned-URL
  signatures (`X-Amz-Signature`) and OAuth `?code=`. The match is deliberately broad and
  over-redacts some harmless names. The request itself is never modified.
- **No headers in errors.** A `ValifetchError` message and its `JSON.stringify` output never
  include request headers.
- **Bounded parsing of untrusted responses.**
  - The SSE parser buffers at most `sseMaxEventSize` UTF-16 code units (default 16 MiB) for one
    pending (unterminated) event, checked after each chunk. Past that it cancels the stream and
    throws `PARSE_ERROR`; an event whose terminating blank line arrives in the same chunk is
    delivered whatever its size, since it no longer needs buffering. It scans each chunk in
    linear time. `sseMaxEventSize: Infinity` removes this bound; an invalid value falls
    back to the default. Leaving the `for await` loop early cancels the response body, so an
    abandoned stream does not keep its connection open.
  - A server `Retry-After` is parsed strictly (all-digit seconds or an HTTP-date; anything else is
    ignored). A delay longer than `retry.maxRetryAfter` (default 60 s) is never waited for and never
    shortened: the request is not retried and the error response is returned or thrown. A server
    therefore cannot stall the client, and the client never retries before the server's requested
    time. An invalid `maxRetryAfter` falls back to the default.
  - Every retry sleep is clamped to 0..2^31 − 1 ms (the `setTimeout` limit), so a huge value never
    overflows into an immediate retry and a `NaN` delay becomes 0.
  - Retries are always bounded by `retry.limit`, even with a `shouldRetry` predicate that always
    returns `true`.
  - In the core client, no regular expression applied to response data or URLs can backtrack
    catastrophically. This claim does not cover the `valifetch/mock` test helper, whose `*`
    wildcards compile to `.*` (consecutive `*` are collapsed to one, but patterns are test-author
    code, not untrusted input).
- **Credentials on redirects.** valifetch delegates redirects to the platform `fetch`. Per the
  Fetch standard, a runtime must drop `Authorization` when a redirect changes origin. On Node
  (undici), a test against a real server confirms this, and that `Cookie` is dropped too. On
  other runtimes this depends on their `fetch`. Use `redirect: 'manual'` if you need full control.

### What is your responsibility

- **User-controlled full URLs (SSRF).** Without `prefixUrl`, or when you pass a user-supplied
  `prefixUrl`, valifetch requests whatever URL it is given. If any part of the URL comes from a user
  (a webhook target, an avatar URL, an `?next=` parameter), validate it against an allow-list of
  schemes and hosts. On a server, also block private, loopback and link-local addresses, and
  re-check after DNS resolution. valifetch has no SSRF policy of its own.
- **Where credentials go.** Auth hooks (`bearerAuth`, `basicAuth`, `jwtRefresh`, your own
  `beforeRequest`) attach credentials to *every* request of that instance, including full URLs on
  other hosts. Keep credentialed instances behind a `prefixUrl`, and do not call user-supplied full
  URLs through them.
- **Hooks you write.** A `beforeRetry` or `afterResponse` hook that builds a new `Request` for a
  different URL also decides which headers go with it. valifetch does not strip them for you.
- **Custom `debug` functions** receive the live, unredacted `Request`/`Response`. `debug: true`
  redacts only names matching its pattern, and logs the URL path as-is, so keep secrets out of
  paths and out of oddly named query parameters.
- **Param semantics.** Encoding stops a param from changing the URL structure. It does not stop an
  empty string (`/users/` instead of `/users/42`) or an unexpected ID. Validate params with
  `paramsSchema` (for example `v.pipe(v.string(), v.minLength(1))`).
- **Response size.** JSON, text, blob, `arrayBuffer`, `formData` and error bodies are read fully
  into memory, as with plain `fetch`. Cap the size of untrusted responses with a `timeout`, or with
  `responseType: 'stream'` and your own byte limit.
- **Validation data in errors.** `ValifetchError.validation.input` and `responseBody` hold the data
  that failed, which may be sensitive. Scrub them before sending errors to a logging service.
- **An already-polluted `Object.prototype`.** valifetch does not defend against prototype pollution
  that happened elsewhere in your process. If another library has polluted `Object.prototype`,
  inherited option values may be read.
