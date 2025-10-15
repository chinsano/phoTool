/**
 * Base application error class with enhanced context and serialization
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown> | undefined;

  constructor(
    message: string,
    status: number = 500,
    code: string = 'internal_error',
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.timestamp = new Date();
    this.context = context ?? undefined;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ('captureStackTrace' in Error) {
      (Error as unknown as { captureStackTrace: (target: object, constructor: object) => void }).captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializes error to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp.toISOString(),
        ...(this.context && { context: this.context }),
      },
    };
  }
}

/**
 * Validation error (400) - Request data failed validation
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, 'validation_error', context);
  }
}

/**
 * Not found error (404) - Requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 404, 'not_found', context);
  }
}

/**
 * Conflict error (409) - Request conflicts with current state
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 409, 'conflict', context);
  }
}

/**
 * Internal error (500) - Server-side error
 */
export class InternalError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 500, 'internal_error', context);
  }
}

/**
 * External service error (502) - Third-party service failure
 */
export class ExternalServiceError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 502, 'external_service_error', context);
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use error classes directly instead
 */
export function createAppError(code: string, status: number, message: string): AppError {
  return new AppError(message, status, code);
}


