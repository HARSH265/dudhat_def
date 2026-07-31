import { logger } from "../config/logger";
import { contactRepository } from "../repositories/contact.repository";
import type { ContactInput } from "../validators/contact.validator";

export interface SubmitContactResult {
  id: string | null;
  /** True when the submission was scored as spam and silently discarded. */
  discarded: boolean;
}

/**
 * Business logic for lead capture. Knows nothing about req/res.
 * docs/ARCHITECTURE.md, docs/API_SPECIFICATION.md §4.3
 */
export const contactService = {
  async submit(input: ContactInput): Promise<SubmitContactResult> {
    // Honeypot. Respond as though it succeeded — telling a bot it was
    // detected just teaches it to stop filling the field.
    if (input.website && input.website.trim() !== "") {
      logger.warn({ reason: "honeypot" }, "Spam submission discarded");
      return { id: null, discarded: true };
    }

    const phone = normalisePhone(input.phone);

    // Duplicate detection FLAGS, never blocks. A genuine repeat enquiry must
    // not be silently dropped. docs/DATABASE_ARCHITECTURE.md §5.7
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await contactRepository.countByEmailSince(
      input.email,
      since
    );
    if (recentCount > 0) {
      logger.info(
        { recentCount },
        "Repeat submission from the same email within 24h"
      );
    }

    const contact = await contactRepository.create({
      name: input.name,
      email: input.email,
      phone,
      ...(input.company ? { company: input.company } : {}),
      message: input.message,
    });

    logger.info({ contactId: contact.id }, "Lead captured");

    return { id: contact.id as string, discarded: false };
  },
};

/**
 * Collapses formatting so the same number is stored one way. Adds the India
 * country code for bare 10-digit numbers, which is what the contact form
 * receives in practice.
 *
 * Full E.164 normalisation arrives with the `leads` model in Phase 1D.
 */
function normalisePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return digits;
}
