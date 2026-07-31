import type { Request, Response } from "express";
import { leadService } from "../services/lead.service";
import { hashIp } from "../utils/crypto";
import type { ContactInput } from "../validators/contact.validator";

/**
 * Reads validated input, calls one service, shapes the response.
 * No validation, no business rules, no database access, no try/catch —
 * asyncHandler forwards rejections to the central error handler.
 * docs/ARCHITECTURE.md, docs/API_SPECIFICATION.md §3
 *
 * @route POST /api/contact      (legacy alias, permanent)
 * @route POST /api/v1/leads
 */
export async function submitContact(req: Request, res: Response): Promise<void> {
  const ipHash = hashIp(req.ip);
  const userAgent = req.headers["user-agent"];
  const referer = req.headers["referer"];

  const result = await leadService.submit(req.body as ContactInput, {
    ...(ipHash ? { ipHash } : {}),
    ...(typeof userAgent === "string" ? { userAgent } : {}),
    ...(typeof referer === "string" ? { sourcePage: referer.slice(0, 200) } : {}),
  });

  // Identical response whether stored or discarded as spam, and identical to
  // the pre-refactor string — ContactForm.jsx renders it directly.
  // docs/API_SPECIFICATION.md §9
  res.status(201).json({
    success: true,
    message: "Thank you! Your message has been sent successfully.",
    data: result.discarded ? {} : { leadNumber: result.leadNumber },
  });
}
