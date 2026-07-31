import { z } from "zod";

/**
 * Field rules from docs/API_SPECIFICATION.md §4.3.
 *
 * The legacy endpoint accepted any non-empty string for every field. These
 * rules are stricter, so they are kept deliberately permissive at the edges
 * — a real enquiry must never be rejected for a formatting opinion.
 */

const NAME_PATTERN = /^[\p{L}\p{M}\s.'-]+$/u;

export const contactSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(100, "Name must be under 100 characters.")
      .regex(NAME_PATTERN, "Name contains unsupported characters."),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email is too long.")
      .email("Please enter a valid email address."),

    // Digits, spaces, and the usual separators. Normalised in the service —
    // rejecting on format here would lose valid international entries.
    phone: z
      .string()
      .trim()
      .min(8, "Please enter a valid phone number.")
      .max(20, "Please enter a valid phone number.")
      .regex(/^[+\d][\d\s()-]*$/, "Please enter a valid phone number."),

    company: z
      .string()
      .trim()
      .max(150, "Company must be under 150 characters.")
      .optional()
      .or(z.literal("")),

    message: z
      .string()
      .trim()
      .min(10, "Please tell us a little more (at least 10 characters).")
      .max(2000, "Message must be under 2000 characters."),

    // Honeypot. Bots fill hidden fields; humans cannot see this one.
    // A non-empty value is accepted with a 201 and discarded by the service.
    // docs/API_SPECIFICATION.md §4.3
    website: z.string().max(200).optional(),
  })
  // Unknown keys are dropped, not rejected — a client sending an extra field
  // should not have its enquiry fail.
  .strip();

export type ContactInput = z.infer<typeof contactSchema>;

export const LEGACY_MISSING_FIELDS_MESSAGE =
  "Please fill all required fields (name, email, phone, message)";
