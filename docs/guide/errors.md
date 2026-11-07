# Errors

Every failure that valifetch itself detects is thrown as a `ValifetchError`, an `Error` subclass with a typed `code`. See the generated [`ValifetchError` reference](/api/index/classes/ValifetchError).

```ts
import { ValifetchError } from 'valifetch';

try {
  const user = await api.get('/users/1', { responseSchema: UserSchema });
} catch (error) {
  if (error instanceof ValifetchError) {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        console.log('Validation failed:', error.validation?.issues);
        console.log('Target:', error.validation?.target); // 'response' | 'body' | 'params' | 'search'
        break;
      case 'HTTP_ERROR':
        console.log('HTTP error:', error.response?.status);
        console.log('Error body:', error.responseBody); // parsed JSON or plain text from the server
        break;
      case 'TIMEOUT_ERROR':
        console.log('Request timed out');
        break;
      case 'NETWORK_ERROR':
        console.log('Network error:', error.message);
        break;
      case 'ABORT_ERROR':
        console.log('Request was cancelled');
        break;
      case 'PARSE_ERROR':
        console.log('Failed to parse response:', error.message);
        break;
    }
  }
}
```

## Error codes

| `ErrorCode` | Thrown when | Fields populated |
|---|---|---|
| `HTTP_ERROR` | Response status is non-2xx and `throwHttpErrors` is `true` | `request`, `response`, `responseBody` (parsed JSON, or text if not JSON) |
| `PARSE_ERROR` | Reading or parsing the response body fails (`json`, `text`, `blob`, `arrayBuffer` or `formData`) | `request`, `response`, `cause` (raw thrown value); `responseBody` = the unparseable raw text, JSON reads only |
| `VALIDATION_ERROR` | A Valibot schema fails (`bodySchema`, `paramsSchema`, `searchSchema` or `responseSchema`) | `validation: { target, issues, input }`; `request`/`response` are only set when `target === 'response'` |
| `TIMEOUT_ERROR` | The configured `timeout` elapses before a response | `request`, `cause` |
| `ABORT_ERROR` | `.cancel()` or a caller `AbortSignal` aborts the request | `request`, `cause` |
| `NETWORK_ERROR` | `fetch` itself throws (offline, DNS failure, etc.) | `request`, `cause` |

For `body`, `params` and `search` validation failures the `Request` does not exist yet, so `error.request` is `undefined`.

## Convenience members

- `error.status` and `error.statusText`, read from `error.response`.
- `error.issues`, which is `error.validation?.issues ?? []`.
- `error.target`, which is `error.validation?.target`.
- Booleans: `isHttpError`, `isValidationError`, `isTimeoutError`, `isNetworkError`, `isAbortError`, `isParseError`.

`cause` is typed `unknown`, matching the standard `Error.cause`, so non-`Error` throws pass through unwrapped.

## HTTP error bodies

On a non-2xx response, valifetch reads the body and attaches it to `error.responseBody`: parsed JSON when the body is JSON, plain text otherwise. This is the right place to read server-side error details such as a `{ "code": "...", "message": "..." }` envelope.

```ts
try {
  await api.post('/users', { json: payload });
} catch (error) {
  if (error instanceof ValifetchError && error.status === 422) {
    const details = v.parse(ApiErrorSchema, error.responseBody);
    // ...
  }
}
```

## beforeError

The `beforeError` [hook](/guide/hooks#beforeerror) runs just before any `ValifetchError` is thrown, for every code. Use it to add context, normalise messages or report to an error tracker.

```ts
const api = valifetch.create({
  hooks: {
    beforeError: [
      (error) => {
        error.message = `[api] ${error.message}`;
        return error;
      },
    ],
  },
});
```

## Errors that are not ValifetchErrors

A hook or a `shouldRetry` predicate that throws propagates its own error as-is, without wrapping, and aborts the request. Passing more than one of `json`, `form` and `body` throws a `TypeError` before any request is made.

## Standalone import

If you only need the class, for example for `instanceof` checks in a module that never creates requests, import it from the lightweight subpath:

```ts
import { ValifetchError } from 'valifetch/error';
```
