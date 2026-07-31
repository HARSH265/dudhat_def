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

      // Preserve the legacy 400 copy ONLY when a required field is genuinely
      // absent or empty. ContactForm.jsx renders res.data.message directly.
      //
      // Phase 1 review M1: this previously also matched `too_small`, which
      // fires for a present-but-short value. A user who filled every field
      // but wrote a brief message was told to fill in the fields they had
      // already filled.
      const body = (req.body ?? {}) as Record<string, unknown>;
      const isAbsent = (field: string): boolean => {
        const value = body[field];
        return (
          value === undefined ||
          value === null ||
          (typeof value === "string" && value.trim() === "")
        );
      };

      const hasMissingRequired = result.error.issues.some((issue) => {
        const field = issue.path[0];
        return typeof field === "string" && isAbsent(field);
      });

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
