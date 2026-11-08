import * as v from 'valibot';
import valifetch, { ValifetchError } from 'valifetch';

// One instance carries the shared options: base URL, timeout and retries.
const api = valifetch.create({
  prefixUrl: 'https://jsonplaceholder.typicode.com',
  timeout: 5000,
  retry: { limit: 2 },
});

const User = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

const NewPost = v.object({
  userId: v.number(),
  title: v.pipe(v.string(), v.minLength(1, 'Title is required')),
  body: v.string(),
});

const Post = v.object({ id: v.number(), ...NewPost.entries });

/** 1. The response is validated, and `user` is typed from the schema. */
export async function validatedGet() {
  const user = await api.get('/users/:id', {
    params: { id: 1 },
    responseSchema: User,
  });
  return user; // { id: number; name: string; email: string }
}

/** 2. The server's data does not match the schema: `id` is a number, not a string. */
export async function responseMismatch() {
  return api.get('/users/:id', {
    params: { id: 1 },
    responseSchema: v.object({ ...User.entries, id: v.string() }),
  });
}

/** 3. A 404 throws an HTTP_ERROR carrying the status and the parsed body. */
export async function httpError() {
  return api.get('/users/:id', {
    params: { id: 9999 },
    responseSchema: User,
  });
}

/** 4. An invalid body is rejected before any request is sent. */
export async function invalidBody() {
  return api.post('/posts', {
    json: { userId: 1, title: '', body: 'Hello' },
    bodySchema: NewPost,
    responseSchema: Post,
  });
}

/** 5. A valid body is sent, and the created post is validated too. */
export async function validPost() {
  return api.post('/posts', {
    json: { userId: 1, title: 'Hello valifetch', body: 'Typed end to end.' },
    bodySchema: NewPost,
    responseSchema: Post,
  });
}

/** Every failure is a ValifetchError with a `code` you can switch on. */
export function describeError(error: unknown) {
  if (!(error instanceof ValifetchError)) throw error;
  return {
    code: error.code,
    message: error.message,
    status: error.status,
    target: error.validation?.target,
    issues: error.issues.map((issue) => ({
      path: issue.path?.map((item) => item.key).join('.'),
      message: issue.message,
    })),
  };
}
