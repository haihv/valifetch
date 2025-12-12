/**
 * Extracts parameter names from a URL path pattern
 * e.g., "/users/:id/posts/:postId" -> "id" | "postId"
 */
export type ExtractPathParams<Path extends string> =
  Path extends `:${infer Param}/${infer Rest}`
    ? Param | ExtractPathParams<Rest>
    : Path extends `:${infer Param}`
      ? Param
      : Path extends `${string}/:${infer Rest}`
        ? ExtractPathParams<`:${Rest}`>
        : never;

/**
 * Creates a record type from extracted path params
 * All params are string | number for flexibility
 */
export type PathParamsRecord<Path extends string> =
  ExtractPathParams<Path> extends never
    ? Record<string, never>
    : Record<ExtractPathParams<Path>, string | number>;

/**
 * Checks if a path has any parameters
 */
export type HasPathParams<Path extends string> =
  ExtractPathParams<Path> extends never ? false : true;
