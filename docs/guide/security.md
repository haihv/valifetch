---
description: "valifetch security policy: supported versions, private vulnerability reporting and the threat model behind its hardening."
---

# Security

The security policy is in the repository:

- [SECURITY.md](https://github.com/haihv/valifetch/blob/main/SECURITY.md): supported versions, how to report a vulnerability privately, and the full threat model.

Please do not report vulnerabilities in public issues. Use GitHub's [private vulnerability reporting](https://github.com/haihv/valifetch/security/advisories/new) instead.

## What valifetch guarantees

A summary; SECURITY.md has the exact rules.

- **Prefix containment.** With `prefixUrl` set, the final URL keeps the prefix origin and its path stays under the prefix path. Absolute inputs such as `https://evil.com` or `//evil.com` become path segments under the prefix, and a path that climbs above it with `..` (including `%2e%2e`) throws a `TypeError`. A `prefixUrl` containing `?` or `#` also throws a `TypeError`. See [Requests](/guide/requests#prefixurl).
- **Path-param encoding.** `params` values are percent-encoded, so they cannot add path segments, a query string or a fragment. The values `.` and `..` throw a `TypeError`, and params are read as own properties only. See [Requests](/guide/requests#path-parameters).
- **No header injection.** Header names and values containing CR, LF or NUL are rejected by the platform `Headers` class with a `TypeError` before the request is sent.
- **Prototype-pollution-safe merging.** `create()` / `extend()` assign user-supplied keys as own data properties, so a JSON-derived `__proto__` key cannot change a prototype.
- **No secrets in built-in logs.** [`debug: true`](/guide/debug) logs a summary with sensitive header and query-parameter values replaced by `[REDACTED]`.
- **Bounded parsing of untrusted responses.** The SSE parser caps the pending (unterminated) event at [`sseMaxEventSize`](/guide/responses#server-sent-events) (default 16 MiB). `Retry-After` is parsed strictly, and a delay longer than [`retry.maxRetryAfter`](/guide/retry#retry-after) (default 60 s) is not retried rather than waited for. Retries are always bounded by `retry.limit`.

## What is your responsibility

- **User-controlled full URLs (SSRF).** Without `prefixUrl`, valifetch requests whatever URL it is given. Validate any user-supplied URL against an allow-list of schemes and hosts.
- **Where credentials go.** Auth hooks attach credentials to every request of their instance, including full URLs on other hosts. Keep credentialed instances behind a `prefixUrl`.
- **Custom `debug` functions** receive the live, unredacted `Request` and `Response`.
- **Response size.** JSON, text, blob and error bodies are read fully into memory, as with plain `fetch`. Use a `timeout`, or `responseType: 'stream'` with your own byte limit, for untrusted responses.
- **[`dedupe`](/guide/requests#deduplication)** keys on method and URL only. Do not use it for calls that differ by headers (for example per-user tokens) or body.
