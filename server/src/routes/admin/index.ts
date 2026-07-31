import { Router } from "express";
import leadRoutes from "./lead.routes";
import { getDashboard } from "../../controllers/lead.controller";
import { authenticate } from "../../middleware/authenticate";
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

export default router;
