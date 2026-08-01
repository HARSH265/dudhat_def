import rateLimit from "express-rate-limit";

// Public lead capture. Tight limit — this endpoint writes to the database
// and triggers notifications, so it is the main abuse target.
// Thresholds: docs/SECURITY_ARCHITECTURE.md §6
export const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
    errorCode: "RATE_LIMITED",
  },
});

/**
 * Per-authenticated-user limits on the admin API. docs/SECURITY_TODO.md S9
 *
 * The global limiter is keyed by IP and sized for scanners, so a compromised
 * session can paginate the entire lead table well inside it — a slow-motion
 * export that bypasses the export audit trail entirely. These are keyed by
 * user id, so sharing an office IP does not share a budget.
 */
const userKey = (req: { user?: { id: string }; ip?: string }): string =>
  req.user?.id ?? req.ip ?? "unknown";

export const adminReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // generous for a UI that paginates and polls
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
    errorCode: "RATE_LIMITED",
  },
});

export const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many changes in a short time. Please slow down.",
    errorCode: "RATE_LIMITED",
  },
});

// Catch-all for everything else. Generous — it exists to blunt scanners,
// not to shape normal traffic.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
    errorCode: "RATE_LIMITED",
  },
});
