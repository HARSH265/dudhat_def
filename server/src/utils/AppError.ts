/**
 * Machine-readable error codes. Stable, never localised.
 * docs/API_SPECIFICATION.md §2
 */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE_SLUG: "DUPLICATE_SLUG",
  DUPLICATE_EMAIL: "DUPLICATE_EMAIL",
  RESOURCE_IN_USE: "RESOURCE_IN_USE",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  RATE_LIMITED: "RATE_LIMITED",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  UNSUPPORTED_FILE_TYPE: "UNSUPPORTED_FILE_TYPE",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  MAINTENANCE_MODE: "MAINTENANCE_MODE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Errors thrown deliberately by the application. Anything that is NOT an
 * AppError is treated as unexpected by the error handler: logged in full,
 * reported to the client as a generic 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCodeValue;
  public readonly errors: FieldError[] | undefined;

  /** Marks this as a deliberate, client-safe error. */
  public readonly isOperational = true;

  constructor(
    statusCode: number,
    message: string,
    errorCode: ErrorCodeValue = ErrorCode.INTERNAL_ERROR,
    errors?: FieldError[]
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errors?: FieldError[]): AppError {
    return new AppError(400, message, ErrorCode.VALIDATION_ERROR, errors);
  }

  static unprocessable(message: string, errors?: FieldError[]): AppError {
    return new AppError(422, message, ErrorCode.VALIDATION_ERROR, errors);
  }

  static unauthorized(
    message = "Authentication required.",
    code: ErrorCodeValue = ErrorCode.INVALID_CREDENTIALS
  ): AppError {
    return new AppError(401, message, code);
  }

  static forbidden(message = "You do not have permission to do that."): AppError {
    return new AppError(403, message, ErrorCode.FORBIDDEN);
  }

  static notFound(message = "Resource not found."): AppError {
    return new AppError(404, message, ErrorCode.NOT_FOUND);
  }

  static conflict(message: string, code: ErrorCodeValue): AppError {
    return new AppError(409, message, code);
  }

  static internal(message = "Something went wrong. Please try again later."): AppError {
    return new AppError(500, message, ErrorCode.INTERNAL_ERROR);
  }
}
