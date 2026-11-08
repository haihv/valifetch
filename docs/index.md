---
layout: home

hero:
  name: valifetch
  text: Type-safe HTTP, built on native fetch
  tagline: Validate responses, bodies, path params and search params with Valibot. Retries, hooks, timeouts, SSE and download progress included.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/
    - theme: alt
      text: View on GitHub
      link: https://github.com/haihv/valifetch

features:
  - title: Schema validation
    details: Validate the response, request body, path params and search params with Valibot. Types are inferred from your schemas.
    link: /guide/validation
    linkText: Validation guide
  - title: Native fetch
    details: No HTTP library underneath. Responses are parsed for you, so there is no .json() call to forget.
    link: /guide/requests
    linkText: Requests guide
  - title: Retries and timeouts
    details: Exponential backoff with jitter, Retry-After support, a custom shouldRetry predicate, and per-request timeouts and cancellation.
    link: /guide/retry
    linkText: Retry guide
  - title: Hooks
    details: beforeRequest, afterResponse, afterParseResponse, beforeRetry and beforeError, with positional signatures that follow ky 1.x.
    link: /guide/hooks
    linkText: Hooks guide
  - title: Streams and SSE
    details: Return text, blobs, array buffers, form data, raw streams or an async iterable of server-sent events.
    link: /guide/responses
    linkText: Responses guide
  - title: Testing built in
    details: createMock() intercepts requests through a hook. No global fetch patching, no extra dependency.
    link: /recipes/testing
    linkText: Mocking recipe
---

## Install

```bash
npm install valifetch valibot
```

## Ten lines to a typed response

```ts
import valifetch from 'valifetch';
import * as v from 'valibot';

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

const user = await valifetch.get('https://api.example.com/users/1', {
  responseSchema: UserSchema,
});
// user: { id: number; name: string; email: string }
```

If the server returns something that does not match the schema, the call rejects with a `ValifetchError` whose `code` is `VALIDATION_ERROR`.

## For AI agents

A condensed, agent-oriented summary of the API is available at [`llms.txt`](/llms.txt).
