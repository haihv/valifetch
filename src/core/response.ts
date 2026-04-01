import type { GenericSchema, InferOutput } from 'valibot';
import { ValifetchError } from '../errors/ValifetchError';
import { validate } from '../validation/validate';

/** Options passed to response-parsing helpers */
export type HandleResponseOptions = {
  response: Response;
  request: Request;
  responseSchema?: GenericSchema;
  validateResponse: boolean;
  throwHttpErrors: boolean;
};

/**
 * Throw a `ValifetchError` with code `HTTP_ERROR` when the response status is not OK.
 * No-ops when `throwHttpErrors` is `false`.
 * @param response - The fetch `Response`
 * @param request - The originating `Request`
 * @param throwHttpErrors - Whether to throw on non-2xx responses
 */
export function checkResponseStatus(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): void {
  if (!response.ok && throwHttpErrors) {
    throw new ValifetchError({
      message: `Request failed with status ${response.status}: ${response.statusText}`,
      code: 'HTTP_ERROR',
      request,
      response,
    });
  }
}

/**
 * Parse the response body as JSON and optionally validate it against a Valibot schema.
 * @param options - Parsing options including the response, request, and optional schema
 * @returns The parsed (and optionally validated) response data
 */
export async function parseJsonResponse<T extends GenericSchema>(
  options: HandleResponseOptions
): Promise<InferOutput<T>> {
  const { response, request, responseSchema, validateResponse } = options;

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new ValifetchError({
      message: 'Failed to parse response as JSON',
      code: 'PARSE_ERROR',
      request,
      response,
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (responseSchema && validateResponse) {
    return validate({
      schema: responseSchema,
      data,
      target: 'response',
      request,
      response,
    });
  }

  return data as InferOutput<T>;
}
