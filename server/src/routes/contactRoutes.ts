import { Router } from "express";
import { submitContact } from "../controllers/contactController";
import { validateBody } from "../middleware/validate";
import {
  contactSchema,
  LEGACY_MISSING_FIELDS_MESSAGE,
} from "../validators/contact.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// GET / was removed in Phase 0 — it returned every stored lead to any
// anonymous caller. Lead reads move to the authenticated admin API.
//
// This route is the permanent legacy alias. Its request shape, success
// message and 400 message must not change. docs/API_SPECIFICATION.md §9
router.post(
  "/",
  validateBody(contactSchema, {
    missingFieldMessage: LEGACY_MISSING_FIELDS_MESSAGE,
  }),
  asyncHandler(submitContact)
);

export default router;
