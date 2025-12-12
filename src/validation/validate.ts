import { safeParse, type GenericSchema, type InferOutput } from 'valibot';
import { ValifetchError } from '../errors/ValifetchError';
import type { ValidationTarget } from '../types';

export type ValidateOptions<T extends GenericSchema> = {
  schema: T;
  data: unknown;
  target: ValidationTarget;
  request?: Request;
  response?: Response;
};

/**
 * Validate data against a valibot schema
 * Throws ValifetchError on validation failure
 */
export function validate<T extends GenericSchema>(
  options: ValidateOptions<T>
): InferOutput<T> {
  const { schema, data, target, request, response } = options;

  const result = safeParse(schema, data);

  if (!result.success) {
    throw new ValifetchError({
      message: `Validation failed for ${target}`,
      code: 'VALIDATION_ERROR',
      request,
      response,
      validation: {
        target,
        issues: result.issues,
        input: data,
      },
    });
  }

  return result.output;
}

/**
 * Validate data without throwing, returns result object
 */
export function safeValidate<T extends GenericSchema>(
  schema: T,
  data: unknown
): { success: true; data: InferOutput<T> } | { success: false; issues: unknown[] } {
  const result = safeParse(schema, data);

  if (result.success) {
    return { success: true, data: result.output };
  }

  return { success: false, issues: result.issues };
}
