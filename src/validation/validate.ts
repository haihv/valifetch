import { type GenericSchema, type InferOutput, safeParse } from 'valibot';
import { ValifetchError } from '../errors/ValifetchError';
import type { ValidationTarget } from '../types';

/** Options for validating data against a Valibot schema */
export type ValidateOptions<T extends GenericSchema> = {
  /** Valibot schema to validate against */
  schema: T;
  /** Data to validate */
  data: unknown;
  /** Which part of the request/response is being validated */
  target: ValidationTarget;
  /** Originating request (included in thrown error) */
  request?: Request;
  /** Associated response (included in thrown error) */
  response?: Response;
};

/**
 * Validate data against a valibot schema.
 * Throws `ValifetchError` (code `VALIDATION_ERROR`) on validation failure.
 * @param options - Schema, data, target, and optional request/response context.
 * @returns The validated, schema-inferred output.
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
 * Validate data against a valibot schema without throwing.
 * @param schema - Valibot schema to validate against.
 * @param data - Data to validate.
 * @returns A discriminated result: `{ success: true, data }` or `{ success: false, issues }`.
 */
export function safeValidate<T extends GenericSchema>(
  schema: T,
  data: unknown
):
  | { success: true; data: InferOutput<T> }
  | { success: false; issues: unknown[] } {
  const result = safeParse(schema, data);

  if (result.success) {
    return { success: true, data: result.output };
  }

  return { success: false, issues: result.issues };
}
