import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createUserSchema,
  loginSchema,
  setUserRoleSchema,
  setUserStatusSchema,
} from "../validators/auth.validator";

const router = Router();

// Brute-force throttle, layered on top of the per-account lockout.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again later.",
    errorCode: "RATE_LIMITED",
  },
});

// --- Public (no token required) ---
router.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(authController.login)
);
router.post("/refresh", asyncHandler(authController.refresh));
router.post("/logout", asyncHandler(authController.logout));

// --- Authenticated ---
router.get("/me", authenticate, asyncHandler(authController.me));
router.post("/logout-all", authenticate, asyncHandler(authController.logoutAll));

// User management is superadmin-only. docs/ADMIN_PANEL_SPECIFICATION.md §4
router.get(
  "/users",
  authenticate,
  authorize("superadmin", "admin"),
  asyncHandler(authController.listUsers)
);

router.post(
  "/users",
  authenticate,
  authorize("superadmin"),
  validateBody(createUserSchema),
  asyncHandler(authController.createUser)
);

router.patch(
  "/users/:id/status",
  authenticate,
  authorize("superadmin"),
  validateBody(setUserStatusSchema),
  asyncHandler(authController.setUserStatus)
);

router.patch(
  "/users/:id/role",
  authenticate,
  authorize("superadmin"),
  validateBody(setUserRoleSchema),
  asyncHandler(authController.setUserRole)
);

export default router;
