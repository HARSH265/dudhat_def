import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { logger } from "../config/logger";
import { isProduction } from "../config/env";
import { AppError, ErrorCode, type FieldError } from "../utils/AppError";

interface ErrorBody {
  success: false;
  message: string;
  errorCode: string;
  errors?: FieldError[];
  requestId?: string;
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: "Route not found.",
    errorCode: ErrorCode.NOT_FOUND,
  } satisfies ErrorBody);
}

/**
 * The single exit point for every error. Controllers throw; this renders.
 * docs/API_SPECIFICATION.md §2, §3
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof mongoose.Error.ValidationError) {
    // Schema-level validation is the last line, not the first. Reaching here
    // means a request validator was missing or too permissive.
    const errors: FieldError[] = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    appError = AppError.unprocessable("Validation failed.", errors);
  } else if (err instanceof mongoose.Error.CastError) {
    appError = AppError.badRequest(`Invalid value for ${err.path}.`);
  } else if (isPayloadTooLarge(err)) {
    // Phase 1 review M3: body-parser throws `entity.too.large`, which
    // previously fell through to a generic 500 — reporting a correctly
    // rejected request as a server fault and logging it at error level.
    appError = new AppError(
      413,
      "Request payload is too large.",
      ErrorCode.FILE_TOO_LARGE
    );
  } else if (isDuplicateKeyError(err)) {
    appError = AppError.conflict(
      "A record with that value already exists.",
      ErrorCode.DUPLICATE_EMAIL
    );
  } else if (err instanceof Error && err.message === "Not allowed by CORS") {
    appError = AppError.forbidden("Origin not allowed.");
  } else {
    // Unexpected. The client gets a generic message; the log gets everything.
    appError = AppError.internal();
  }

  const isUnexpected = !(err instanceof AppError);
  const currentRequestId = req.id === undefined ? undefined : String(req.id);
  const logPayload = {
    requestId: currentRequestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: appError.statusCode,
    errorCode: appError.errorCode,
    err,
  };

  if (isUnexpected || appError.statusCode >= 500) {
    logger.error(logPayload, "Unhandled error");
  } else {
    logger.warn(logPayload, "Request failed");
  }

  const body: ErrorBody = {
    success: false,
    message: appError.message,
    errorCode: appError.errorCode,
  };

  if (appError.errors && appError.errors.length > 0) {
    body.errors = appError.errors;
  }

  // The request ID lets a developer find the log line. Withheld in
  // production, where it is one more internal detail on the wire.
  if (!isProduction && currentRequestId) {
    body.requestId = currentRequestId;
  }

  res.status(appError.statusCode).json(body);
}

function isPayloadTooLarge(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    (err as { type?: unknown }).type === "entity.too.large"
  );
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000
  );
}
