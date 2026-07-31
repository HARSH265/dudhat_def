import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not forward rejected promises to error middleware — an
 * async handler that throws leaves the request hanging until it times out.
 * This wrapper catches the rejection and passes it to next().
 *
 * Every async controller goes through this, so no controller contains
 * try/catch. docs/API_SPECIFICATION.md §3
 *
 * Removable if the project moves to Express 5, which forwards rejections
 * natively.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
