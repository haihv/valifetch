import type { BaseIssue } from 'valibot';
import type { ErrorCode, ValidationTarget } from '../types';

/**
 * Validation error details
 */
export type ValidationErrorInfo = {
  /** Which validation failed */
  target: ValidationTarget;
  /** Valibot issues array */
  issues: BaseIssue<unknown>[];
  /** The invalid data that was validated */
  input: unknown;
};

/**
 * Options for creating a ValifetchError
 */
export type ValifetchErrorOptions = {
  /** Error message */
  message: string;
  /** Error code for pattern matching */
  code: ErrorCode;
  /** HTTP request that caused the error */
  request?: Request | undefined;
  /** HTTP response (if received) */
  response?: Response | undefined;
  /** Validation error details (if validation failed) */
  validation?: ValidationErrorInfo | undefined;
  /** Original error cause */
  cause?: Error | undefined;
};

/**
 * Custom error class for valifetch errors
 * Provides structured error information for better error handling
 */
export class ValifetchError extends Error {
  /** Error code for discriminated error handling */
  readonly code: ErrorCode;
  /** Original request that caused the error */
  readonly request?: Request;
  /** Response received (if any) */
  readonly response?: Response;
  /** Validation error details (if validation failed) */
  readonly validation?: ValidationErrorInfo;

  constructor(options: ValifetchErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'ValifetchError';
    this.code = options.code;
    this.request = options.request;
    this.response = options.response;
    this.validation = options.validation;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValifetchError);
    }
  }

  /** Check if this is a validation error */
  get isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  /** Check if this is an HTTP error (non-2xx status) */
  get isHttpError(): boolean {
    return this.code === 'HTTP_ERROR';
  }

  /** Check if this is a timeout error */
  get isTimeoutError(): boolean {
    return this.code === 'TIMEOUT_ERROR';
  }

  /** Check if this is a network error */
  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  /** Check if this is an abort/cancel error */
  get isAbortError(): boolean {
    return this.code === 'ABORT_ERROR';
  }

  /** Check if this is a parse error (e.g., invalid JSON) */
  get isParseError(): boolean {
    return this.code === 'PARSE_ERROR';
  }

  /** Get flattened validation issues (convenience) */
  get issues(): BaseIssue<unknown>[] {
    return this.validation?.issues ?? [];
  }

  /** HTTP status code (if available) */
  get status(): number | undefined {
    return this.response?.status;
  }

  /** HTTP status text (if available) */
  get statusText(): string | undefined {
    return this.response?.statusText;
  }
}
