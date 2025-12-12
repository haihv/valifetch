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

export async function parseJsonResponse<T extends GenericSchema>(
  options: HandleResponseOptions
): Promise<InferOutput<T>> {
  const { response, request, responseSchema, validateResponse, throwHttpErrors } = options;

  checkResponseStatus(response, request, throwHttpErrors);

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

export async function parseTextResponse(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): Promise<string> {
  checkResponseStatus(response, request, throwHttpErrors);
  return response.text();
}

export async function parseArrayBufferResponse(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): Promise<ArrayBuffer> {
  checkResponseStatus(response, request, throwHttpErrors);
  return response.arrayBuffer();
}

export async function parseBlobResponse(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): Promise<Blob> {
  checkResponseStatus(response, request, throwHttpErrors);
  return response.blob();
}

export async function parseFormDataResponse(
  response: Response,
  request: Request,
  throwHttpErrors: boolean
): Promise<FormData> {
  checkResponseStatus(response, request, throwHttpErrors);
  return response.formData();
}
