import { Router } from "express";
import leadRoutes from "./lead.routes";
import mediaRoutes from "./media.routes";
import { categoryRouter, productRouter } from "./catalogue.routes";
import { getDashboard } from "../../controllers/lead.controller";
import { authenticate } from "../../middleware/authenticate";
import { adminReadLimiter, adminWriteLimiter } from "../../middleware/rateLimit";
import { authorize } from "../../middleware/authorize";
import { validateQuery } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { dashboardQuerySchema } from "../../validators/lead.validator";

const router = Router();

/**
 * Authentication is applied at the mount, not per route, so a route added
 * here without an explicit gate is inaccessible rather than open. The failure
 * mode of forgetting is lockout, never exposure.
 * docs/SECURITY_ARCHITECTURE.md §4
 */
router.use(authenticate);

// Per-user limits, applied after authenticate so req.user.id is the key.
// Reads and writes are budgeted separately — a UI that paginates should not
// exhaust the allowance for changing a lead's status.
// docs/SECURITY_TODO.md S9
router.use((req, res, next) => {
  const isRead = req.method === "GET" || req.method === "HEAD";
  return isRead
    ? adminReadLimiter(req, res, next)
    : adminWriteLimiter(req, res, next);
});

// Admin responses are never cached — stale lead data in a sales workflow is
// worse than a round-trip. docs/API_SPECIFICATION.md §7
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.get(
  "/dashboard",
  authorize("superadmin", "admin", "editor", "sales"),
  validateQuery(dashboardQuerySchema),
  asyncHandler(getDashboard)
);

router.use("/leads", leadRoutes);
router.use("/media", mediaRoutes);
router.use("/categories", categoryRouter);
router.use("/products", productRouter);

export default router;
