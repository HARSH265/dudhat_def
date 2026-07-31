/**
 * Collapses formatting so the same number is stored one way. Adds the India
 * country code for bare 10-digit numbers, which is what the contact form
 * receives in practice.
 *
 * Phase 1 review M6: lives here rather than inside lead.service so the
 * migration applies the identical rule. Previously the service normalised
 * and the migration copied verbatim, leaving one collection with two phone
 * formats and no way to repair it (the migration is idempotent and skips
 * rows it has already written).
 */
export function normalisePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return digits;
}
