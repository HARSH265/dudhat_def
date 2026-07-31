import type { NextFunction, Request, Response } from "express";
import type { Role } from "../models/User";
import { AppError } from "../utils/AppError";

/**
 * Role gate. The panel hides unavailable actions, but a hidden button is not
 * a permission — this is the enforcement.
 * Matrix: docs/ADMIN_PANEL_SPECIFICATION.md §4
 */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized("Authentication required."));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden("You do not have permission to do that."));
      return;
    }
    next();
  };
}
