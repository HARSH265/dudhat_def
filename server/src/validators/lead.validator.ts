import { z } from "zod";
import { LEAD_SOURCES, LEAD_STATUSES, LEAD_TYPES } from "../models/Lead";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier.");

/** Shared list controls. docs/API_SPECIFICATION.md §2 */
export const leadListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    // Capped server-side; a client asking for 10000 gets 100.
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z
      .enum(["-createdAt", "createdAt", "-updatedAt", "status", "-status"])
      .default("-createdAt"),
    status: z.enum(LEAD_STATUSES).optional(),
    type: z.enum(LEAD_TYPES).optional(),
    source: z.enum(LEAD_SOURCES).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    assignedTo: objectId.optional(),
    productId: objectId.optional(),
    // Absent means "not spam" — the spam view is opt-in, so the default
    // working list is not polluted.
    isSpam: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    search: z.string().trim().min(1).max(200).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strip();

export const updateLeadSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    // Required by the service when status becomes "lost".
    lostReason: z.string().trim().max(500).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    estimatedValue: z.number().min(0).max(1_000_000_000).optional(),
  })
  .strip()
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update.",
  });

export const addNoteSchema = z
  .object({
    note: z.string().trim().min(1, "Note cannot be empty.").max(2000),
  })
  .strip();

export const assignLeadSchema = z
  .object({
    // null clears the assignment.
    assignedTo: objectId.nullable(),
  })
  .strip();

export const markSpamSchema = z
  .object({
    isSpam: z.boolean(),
  })
  .strip();

/** Manual creation — phone or walk-in leads entered by sales. */
export const createLeadSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
    phone: z.string().trim().min(8).max(20),
    company: z.string().trim().max(150).optional(),
    message: z.string().trim().min(1).max(2000),
    type: z.enum(LEAD_TYPES).default("contact"),
    source: z.enum(LEAD_SOURCES).default("phone"),
    quantity: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    estimatedValue: z.number().min(0).optional(),
  })
  .strip();

export const dashboardQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strip();

export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
