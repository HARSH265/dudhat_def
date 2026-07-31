import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as ctrl from "../../controllers/lead.controller";
import { authorize } from "../../middleware/authorize";
import { validateBody, validateQuery } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  addNoteSchema,
  assignLeadSchema,
  createLeadSchema,
  leadListQuerySchema,
  markSpamSchema,
  updateLeadSchema,
} from "../../validators/lead.validator";

const router = Router();

// Bulk export is the panel's largest data egress.
// docs/SECURITY_ARCHITECTURE.md §8
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Export limit reached. Try again later.",
    errorCode: "RATE_LIMITED",
  },
});

// `authenticate` is applied at the admin router mount, so every route here is
// already authenticated. Role gates only. docs/ADMIN_PANEL_SPECIFICATION.md §4

router.get(
  "/export",
  authorize("superadmin", "admin"),
  exportLimiter,
  validateQuery(leadListQuerySchema),
  asyncHandler(ctrl.exportLeads)
);

router.get(
  "/",
  authorize("superadmin", "admin", "sales"),
  validateQuery(leadListQuerySchema),
  asyncHandler(ctrl.listLeads)
);

router.post(
  "/",
  authorize("superadmin", "admin", "sales"),
  validateBody(createLeadSchema),
  asyncHandler(ctrl.createLead)
);

router.get(
  "/:id",
  authorize("superadmin", "admin", "sales"),
  asyncHandler(ctrl.getLead)
);

router.patch(
  "/:id",
  authorize("superadmin", "admin", "sales"),
  validateBody(updateLeadSchema),
  asyncHandler(ctrl.updateLead)
);

router.post(
  "/:id/notes",
  authorize("superadmin", "admin", "sales"),
  validateBody(addNoteSchema),
  asyncHandler(ctrl.addNote)
);

router.post(
  "/:id/assign",
  authorize("superadmin", "admin"),
  validateBody(assignLeadSchema),
  asyncHandler(ctrl.assignLead)
);

router.post(
  "/:id/spam",
  authorize("superadmin", "admin"),
  validateBody(markSpamSchema),
  asyncHandler(ctrl.markSpam)
);

// Soft delete only, superadmin only. Leads are business records.
router.delete("/:id", authorize("superadmin"), asyncHandler(ctrl.deleteLead));

export default router;
