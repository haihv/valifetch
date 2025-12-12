import type { GenericSchema, InferOutput } from 'valibot';
import { ValifetchError } from '../errors/ValifetchError';
import { validate } from '../validation/validate';

export type HandleResponseOptions = {
  response: Response;
  request: Request;
  responseSchema?: GenericSchema;
  validateResponse: boolean;
  throwHttpErrors: boolean;
};

/**
 * Check if response is OK, throw if not and throwHttpErrors is enabled
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
 * Parse and optionally validate JSON response
 */
export async function parseJsonResponse<T extends GenericSchema>(
  options: HandleResponseOptions
): Promise<InferOutput<T>> {
  const { response, request, responseSchema, validateResponse, throwHttpErrors } = options;

  // Check status first
  checkResponseStatus(response, request, throwHttpErrors);

  // Parse JSON
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new ValifetchError({
      message: 'Failed to parse response as JSON',
      code: 'NETWORK_ERROR',
      request,
      response,
      cause: error instanceof Error ? error : undefined,
    });
  }

  // Validate response if schema provided and validation enabled
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

/**
 * Parse response as text
 */
export async function parseTextResponse(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): Promise<string> {
  checkResponseStatus(response, request, throwHttpErrors);
  return response.text();
}

/**
 * Parse response as ArrayBuffer
 */
export async function parseArrayBufferResponse(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): Promise<ArrayBuffer> {
  checkResponseStatus(response, request, throwHttpErrors);
  return response.arrayBuffer();
}

/**
 * Parse response as Blob
 */
export async function parseBlobResponse(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): Promise<Blob> {
  checkResponseStatus(response, request, throwHttpErrors);
  return response.blob();
}

/**
 * Parse response as FormData
 */
export async function parseFormDataResponse(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): Promise<FormData> {
  checkResponseStatus(response, request, throwHttpErrors);
  return response.formData();
}
