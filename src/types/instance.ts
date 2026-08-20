import type { GenericSchema, InferOutput } from 'valibot';
import type {
  HttpMethod,
  ValifetchInstanceOptions,
  ValifetchOptions,
} from './options';

/**
 * A `Promise<T>` with an attached `.cancel()` method that aborts the in-flight request.
 *
 * Cancelling rejects the promise with a `ValifetchError` whose `code` is `'ABORT_ERROR'`.
 *
 * @example
 * ```ts
 * const req = api.get('/slow-endpoint');
 * req.cancel(); // aborts immediately
 * try {
 *   await req;
 * } catch (err) {
 *   // err.code === 'ABORT_ERROR'
 * }
 * ```
 */
export type CancellablePromise<T> = Promise<T> & {
  /**
   * Aborts the in-flight request.
   * The promise rejects with a `ValifetchError` whose `code` is `'ABORT_ERROR'`.
   */
  cancel(): void;
};

/**
 * Response format options
 */
export type ResponseType =
  | 'json'
  | 'text'
  | 'blob'
  | 'arrayBuffer'
  | 'formData'
  | 'stream'
  | 'raw'
  | 'sse';

/**
 * Options for GET-like methods (no body)
 */
export type GetOptions<
  TPath extends string = string,
  TResponseSchema extends GenericSchema | undefined = undefined,
  TParamsSchema extends GenericSchema | undefined = undefined,
  TSearchSchema extends GenericSchema | undefined = undefined,
> = Omit<
  ValifetchOptions<
    TPath,
    TResponseSchema,
    undefined,
    TParamsSchema,
    TSearchSchema
  >,
  'json' | 'bodySchema' | 'form'
> & {
  /** Response format - defaults to 'json' */
  responseType?: ResponseType;
};

/**
 * Options for POST-like methods (with body)
 */
export type PostOptions<
  TPath extends string = string,
  TResponseSchema extends GenericSchema | undefined = undefined,
  TBodySchema extends GenericSchema | undefined = undefined,
  TParamsSchema extends GenericSchema | undefined = undefined,
  TSearchSchema extends GenericSchema | undefined = undefined,
> = ValifetchOptions<
  TPath,
  TResponseSchema,
  TBodySchema,
  TParamsSchema,
  TSearchSchema
> & {
  /** Response format - defaults to 'json' */
  responseType?: ResponseType;
};

/**
 * Infer response type: schema > generic > unknown
 */
type ResolveResponseType<TData, TResponseSchema> =
  TResponseSchema extends GenericSchema ? InferOutput<TResponseSchema> : TData;

/**
 * Callable instance type for ky-style syntax
 */
export type CallableInstance = {
  /**
   * Perform a request, defaulting to `GET`. Pass `method` to choose another verb
   * and `responseType` to change how the body is parsed.
   */
  <
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TBodySchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: PostOptions<
      TPath,
      TResponseSchema,
      TBodySchema,
      TParamsSchema,
      TSearchSchema
    > & {
      /** HTTP method for the request (default: `'GET'`) */
      method?: HttpMethod;
    }
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;
  /** GET request */
  get<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, TResponseSchema, TParamsSchema, TSearchSchema>
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;
  /** POST request */
  post<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TBodySchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: PostOptions<
      TPath,
      TResponseSchema,
      TBodySchema,
      TParamsSchema,
      TSearchSchema
    >
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;
  /** PUT request */
  put<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TBodySchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: PostOptions<
      TPath,
      TResponseSchema,
      TBodySchema,
      TParamsSchema,
      TSearchSchema
    >
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;
  /** PATCH request */
  patch<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TBodySchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: PostOptions<
      TPath,
      TResponseSchema,
      TBodySchema,
      TParamsSchema,
      TSearchSchema
    >
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;
  /** DELETE request */
  delete<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, TResponseSchema, TParamsSchema, TSearchSchema>
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;
  /**
   * HEAD request — always resolves to `void`; the response body is never read,
   * so `responseType` and `responseSchema` are not accepted.
   */
  head<
    TPath extends string = string,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: Omit<
      GetOptions<TPath, undefined, TParamsSchema, TSearchSchema>,
      'responseSchema' | 'responseType'
    >
  ): CancellablePromise<void>;
  /** OPTIONS request */
  options<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, TResponseSchema, TParamsSchema, TSearchSchema>
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;
  /**
   * Run multiple requests in parallel and resolve to a tuple of their results,
   * preserving each element's type (sugar over `Promise.all`). Rejects as soon
   * as any input rejects.
   *
   * The returned promise is cancellable: `.cancel()` aborts every input that
   * exposes a `.cancel()` method (e.g. other valifetch requests); inputs without
   * one are ignored. A rejection does not cancel the remaining requests.
   *
   * @example
   * ```ts
   * const [user, posts] = await api.all([
   *   api.get('/users/1', { responseSchema: UserSchema }),
   *   api.get('/posts', { responseSchema: PostsSchema }),
   * ]);
   * ```
   */
  all<T extends readonly unknown[] | []>(
    requests: T
  ): CancellablePromise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;

  /**
   * Run multiple requests in parallel and resolve once all have settled, never
   * rejecting (sugar over `Promise.allSettled`). Each result is a standard
   * `PromiseSettledResult`: `{ status: 'fulfilled', value }` or
   * `{ status: 'rejected', reason }` (the `reason` is typically a `ValifetchError`).
   *
   * The returned promise is cancellable: `.cancel()` aborts every input that
   * exposes a `.cancel()` method; inputs without one are ignored. A rejection
   * does not cancel the remaining requests.
   *
   * @example
   * ```ts
   * const results = await api.allSettled([api.get('/a'), api.get('/b')]);
   * for (const r of results) {
   *   if (r.status === 'fulfilled') console.log(r.value);
   *   else console.error(r.reason);
   * }
   * ```
   */
  allSettled<T extends readonly unknown[] | []>(
    requests: T
  ): CancellablePromise<{
    -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>>;
  }>;

  /** Create new instance with defaults */
  create(options?: ValifetchInstanceOptions): CallableInstance;
  /** Extend current instance with additional options */
  extend(
    options:
      | ValifetchInstanceOptions
      | ((parent: ValifetchInstanceOptions) => ValifetchInstanceOptions)
  ): CallableInstance;
};

/**
 * The main valifetch instance type
 */
export type ValifetchInstance = {
  /**
   * GET request - returns parsed JSON by default
   * @template TData - Generic type for response (used when no schema provided)
   */
  get<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, TResponseSchema, TParamsSchema, TSearchSchema>
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;

  /**
   * POST request - returns parsed JSON by default
   * @template TData - Generic type for response (used when no schema provided)
   */
  post<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TBodySchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: PostOptions<
      TPath,
      TResponseSchema,
      TBodySchema,
      TParamsSchema,
      TSearchSchema
    >
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;

  /**
   * PUT request - returns parsed JSON by default
   * @template TData - Generic type for response (used when no schema provided)
   */
  put<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TBodySchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: PostOptions<
      TPath,
      TResponseSchema,
      TBodySchema,
      TParamsSchema,
      TSearchSchema
    >
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;

  /**
   * PATCH request - returns parsed JSON by default
   * @template TData - Generic type for response (used when no schema provided)
   */
  patch<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TBodySchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: PostOptions<
      TPath,
      TResponseSchema,
      TBodySchema,
      TParamsSchema,
      TSearchSchema
    >
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;

  /**
   * DELETE request - returns parsed JSON by default
   * @template TData - Generic type for response (used when no schema provided)
   */
  delete<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, TResponseSchema, TParamsSchema, TSearchSchema>
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;

  /**
   * HEAD request — always resolves to `void`; the response body is never read,
   * so `responseType` and `responseSchema` are not accepted.
   */
  head<
    TPath extends string = string,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: Omit<
      GetOptions<TPath, undefined, TParamsSchema, TSearchSchema>,
      'responseSchema' | 'responseType'
    >
  ): CancellablePromise<void>;

  /**
   * OPTIONS request - returns parsed JSON by default
   * @template TData - Generic type for response (used when no schema provided)
   */
  options<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, TResponseSchema, TParamsSchema, TSearchSchema>
  ): CancellablePromise<ResolveResponseType<TData, TResponseSchema>>;

  /**
   * Run multiple requests in parallel and resolve to a tuple of their results,
   * preserving each element's type (sugar over `Promise.all`). Rejects as soon
   * as any input rejects.
   *
   * The returned promise is cancellable: `.cancel()` aborts every input that
   * exposes a `.cancel()` method (e.g. other valifetch requests); inputs without
   * one are ignored. A rejection does not cancel the remaining requests.
   *
   * @example
   * ```ts
   * const [user, posts] = await api.all([
   *   api.get('/users/1', { responseSchema: UserSchema }),
   *   api.get('/posts', { responseSchema: PostsSchema }),
   * ]);
   * ```
   */
  all<T extends readonly unknown[] | []>(
    requests: T
  ): CancellablePromise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;

  /**
   * Run multiple requests in parallel and resolve once all have settled, never
   * rejecting (sugar over `Promise.allSettled`). Each result is a standard
   * `PromiseSettledResult`: `{ status: 'fulfilled', value }` or
   * `{ status: 'rejected', reason }` (the `reason` is typically a `ValifetchError`).
   *
   * The returned promise is cancellable: `.cancel()` aborts every input that
   * exposes a `.cancel()` method; inputs without one are ignored. A rejection
   * does not cancel the remaining requests.
   *
   * @example
   * ```ts
   * const results = await api.allSettled([api.get('/a'), api.get('/b')]);
   * for (const r of results) {
   *   if (r.status === 'fulfilled') console.log(r.value);
   *   else console.error(r.reason);
   * }
   * ```
   */
  allSettled<T extends readonly unknown[] | []>(
    requests: T
  ): CancellablePromise<{
    -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>>;
  }>;

  /** Create new instance with defaults */
  create(options?: ValifetchInstanceOptions): ValifetchInstance;

  /** Extend current instance with additional options */
  extend(
    options:
      | ValifetchInstanceOptions
      | ((parent: ValifetchInstanceOptions) => ValifetchInstanceOptions)
  ): ValifetchInstance;

  /** Wrap instance for callable ky-style syntax */
  callable(): CallableInstance;
};
