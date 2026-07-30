const rateLimit = require("express-rate-limit");

// Public lead capture. Tight limit — this endpoint writes to the database
// and triggers notifications, so it is the main abuse target.
// Thresholds: docs/SECURITY_ARCHITECTURE.md §6
const leadLimiter = rateLimit({
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

// Catch-all for everything else. Generous — it exists to blunt scanners,
// not to shape normal traffic.
const globalLimiter = rateLimit({
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

module.exports = { leadLimiter, globalLimiter };
