import type { GenericSchema, InferOutput } from 'valibot';
import type { ValifetchOptions, ValifetchInstanceOptions } from './options';

/**
 * Response format options
 */
export type ResponseType =
  | 'json'
  | 'text'
  | 'blob'
  | 'arrayBuffer'
  | 'formData'
  | 'raw';

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
  'json' | 'bodySchema'
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
  <TData = unknown>(url: string, options?: ValifetchOptions): Promise<TData>;
  get<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, TResponseSchema, TParamsSchema, TSearchSchema>
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;
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
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;
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
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;
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
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;
  delete<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, TResponseSchema, TParamsSchema, TSearchSchema>
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;
  head<
    TPath extends string = string,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, undefined, TParamsSchema, TSearchSchema>
  ): Promise<void>;
  options<
    TData = unknown,
    TPath extends string = string,
    TResponseSchema extends GenericSchema | undefined = undefined,
    TParamsSchema extends GenericSchema | undefined = undefined,
    TSearchSchema extends GenericSchema | undefined = undefined,
  >(
    url: TPath,
    options?: GetOptions<TPath, TResponseSchema, TParamsSchema, TSearchSchema>
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;
  create(options?: ValifetchInstanceOptions): CallableInstance;
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
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;

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
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;

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
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;

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
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;

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
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;

  /** HEAD request - returns void */
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
  ): Promise<void>;

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
  ): Promise<ResolveResponseType<TData, TResponseSchema>>;

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
