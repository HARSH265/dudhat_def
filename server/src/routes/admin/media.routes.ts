import { Router } from "express";
import * as ctrl from "../../controllers/media.controller";
import { authorize } from "../../middleware/authorize";
import { handleUpload } from "../../middleware/upload";
import { validateBody, validateQuery } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  mediaListQuerySchema,
  updateMediaSchema,
} from "../../validators/media.validator";

const router = Router();

// `authenticate` is applied at the admin router mount. There is no public
// upload path — a lead form does not accept attachments.
// docs/SECURITY_ARCHITECTURE.md §7

router.get(
  "/",
  authorize("superadmin", "admin", "editor"),
  validateQuery(mediaListQuerySchema),
  asyncHandler(ctrl.listMedia)
);

router.post(
  "/upload",
  authorize("superadmin", "admin", "editor"),
  handleUpload,
  asyncHandler(ctrl.uploadMedia)
);

router.get(
  "/:id",
  authorize("superadmin", "admin", "editor"),
  asyncHandler(ctrl.getMedia)
);

router.put(
  "/:id",
  authorize("superadmin", "admin", "editor"),
  validateBody(updateMediaSchema),
  asyncHandler(ctrl.updateMedia)
);

router.post(
  "/:id/replace",
  authorize("superadmin", "admin", "editor"),
  handleUpload,
  asyncHandler(ctrl.replaceMedia)
);

// Delete is admin+; blocked by the service while usageCount > 0.
router.delete(
  "/:id",
  authorize("superadmin", "admin"),
  asyncHandler(ctrl.deleteMedia)
);

export default router;
