import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// `Request.id` is declared by pino-http as `string | number`. Not re-declared
// here — a second augmentation would conflict rather than merge.

/**
 * Correlates a client-visible error with its server-side log entry.
 * Honours an inbound X-Request-Id so a proxy's ID survives.
 * docs/API_SPECIFICATION.md §2
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers["x-request-id"];
  const id =
    typeof inbound === "string" && inbound.length > 0 && inbound.length <= 128
      ? inbound
      : randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
