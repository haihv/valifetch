# Security

The security policy, including how to report a vulnerability, is in the repository:

- [SECURITY.md](https://github.com/haihv/valifetch/blob/main/SECURITY.md)

Please do not report vulnerabilities in public issues.

Two behaviours worth knowing when you use valifetch:

- [`debug: true`](/guide/debug) logs raw requests and responses including headers such as `Authorization`. Never enable it in production.
- [`dedupe`](/guide/requests#deduplication) keys on method and URL only. Do not use it for calls that differ by headers (for example per-user tokens) or body.
