import { Router } from "express";
import { submitContact } from "../controllers/contactController";

const router = Router();

// GET / was removed in Phase 0 — it returned every stored lead to any
// anonymous caller. Lead reads move to the authenticated admin API.
// docs/API_SPECIFICATION.md §9
router.post("/", submitContact);

export default router;
