import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError, type FieldError } from "../utils/AppError";

interface ValidateOptions {
  /**
   * Overrides the top-level message when a *required* field is missing or
   * empty. The legacy contact endpoint needs its exact original string.
   * docs/API_SPECIFICATION.md §9
   */
  missingFieldMessage?: string;
}

/**
 * Validates and REPLACES req.body with the parsed result. Unknown keys are
 * stripped rather than passed through, which is what stops mass assignment:
 * a client sending { name, email, role: "superadmin" } has `role` removed
 * here, not merely ignored downstream.
 * docs/SECURITY_ARCHITECTURE.md §6
 */
export function validateBody<T>(
  schema: ZodType<T>,
  options: ValidateOptions = {}
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const errors: FieldError[] = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }));

      // Preserve the legacy 400 copy when the failure is a missing required
      // field. ContactForm.jsx renders res.data.message directly.
      const hasMissingRequired = result.error.issues.some(
        (issue) =>
          issue.code === "invalid_type" ||
          (issue.code === "too_small" && issue.path.length > 0)
      );

      const message =
        hasMissingRequired && options.missingFieldMessage
          ? options.missingFieldMessage
          : (errors[0]?.message ?? "Validation failed.");

      next(AppError.badRequest(message, errors));
      return;
    }

    req.body = result.data;
    next();
  };
}
