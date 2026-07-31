import { logger } from "../config/logger";
import { leadRepository } from "../repositories/lead.repository";
import type { ContactInput } from "../validators/contact.validator";

export interface SubmitLeadContext {
  ipHash?: string;
  userAgent?: string;
  sourcePage?: string;
}

export interface SubmitLeadResult {
  leadNumber: string | null;
  discarded: boolean;
}

/** Heuristics are additive; the total decides whether a lead is flagged. */
const SPAM_THRESHOLD = 60;

export const leadService = {
  async submit(
    input: ContactInput,
    ctx: SubmitLeadContext = {}
  ): Promise<SubmitLeadResult> {
    // Honeypot. Respond as though it succeeded — telling a bot it was
    // detected just teaches it to stop filling the field.
    if (input.website && input.website.trim() !== "") {
      logger.warn({ reason: "honeypot" }, "Spam submission discarded");
      return { leadNumber: null, discarded: true };
    }

    const spamScore = scoreSpam(input);
    const phone = normalisePhone(input.phone);

    // Duplicate detection FLAGS, never blocks. A genuine repeat enquiry must
    // not be silently dropped. docs/DATABASE_ARCHITECTURE.md §5.7
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await leadRepository.countByEmailSince(input.email, since);
    if (recent > 0) {
      logger.info({ recent }, "Repeat submission from the same email within 24h");
    }

    const leadNumber = await leadRepository.generateLeadNumber();

    const lead = await leadRepository.create({
      leadNumber,
      name: input.name,
      email: input.email,
      phone,
      ...(input.company ? { company: input.company } : {}),
      message: input.message,
      type: "contact",
      source: "website",
      ...(ctx.sourcePage ? { sourcePage: ctx.sourcePage } : {}),
      ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
      ...(ctx.userAgent ? { userAgent: ctx.userAgent } : {}),
      isSpam: spamScore >= SPAM_THRESHOLD,
      spamScore,
    });

    // The timeline starts at creation. userId is null — this was the public.
    await leadRepository.addActivity({ leadId: lead._id, type: "created" });

    logger.info({ leadNumber, spamScore }, "Lead captured");

    return { leadNumber, discarded: false };
  },
};

/**
 * Content heuristics. Deliberately conservative — a false positive files a
 * real enquiry under Spam, so the threshold needs several signals to agree.
 * docs/SECURITY_ARCHITECTURE.md §6
 */
function scoreSpam(input: ContactInput): number {
  let score = 0;
  const message = input.message.toLowerCase();

  const urlCount = (message.match(/https?:\/\//g) ?? []).length;
  if (urlCount >= 1) score += 20;
  if (urlCount >= 3) score += 30;

  if (/\b(seo|backlink|crypto|casino|viagra|loan offer)\b/.test(message)) score += 30;
  if (/(.)\1{6,}/.test(message)) score += 20;
  if (input.name === input.name.toUpperCase() && input.name.length > 8) score += 10;

  return Math.min(score, 100);
}

/**
 * Collapses formatting so the same number is stored one way. Adds the India
 * country code for bare 10-digit numbers, which is what the form receives.
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
