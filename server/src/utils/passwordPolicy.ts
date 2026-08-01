/**
 * Password policy. docs/SECURITY_ARCHITECTURE.md §3
 *
 * Length over composition. Mandated symbol classes produce "Password1!" and
 * nothing else — they raise user friction far more than attacker cost. The
 * rules below reject the passwords that actually get chosen.
 */

export const MIN_LENGTH = 12;
export const MAX_LENGTH = 200;

/**
 * The passwords that appear at the top of every breach corpus, plus the ones
 * this project invites specifically (brand name, role names).
 *
 * NOT the full top-10k list that SECURITY_ARCHITECTURE §3 calls for —
 * shipping 10k entries inline is a poor trade for a handful of admin
 * accounts, and a hosted breach-check API would leak a password prefix to a
 * third party. Recorded as a known narrowing in docs/SECURITY_TODO.md S4.
 */
/**
 * Matched as SUBSTRINGS, not exact values.
 *
 * An exact-match set is close to useless: it catches "password" but accepts
 * "password123456", "mypassword1" and "qwertyuiop99", which are exactly what
 * people choose when told to make it longer. Anything built around one of
 * these stems is rejected.
 */
const COMMON_STEMS = [
  "password", "passw0rd", "p@ssword", "p@ssw0rd", "pass123",
  "qwerty", "asdfgh", "zxcvbn", "qazwsx",
  "letmein", "welcome", "monkey", "dragon", "sunshine", "iloveyou",
  "princess", "football", "baseball", "superman", "trustno1",
  "admin", "administrator", "root", "guest", "changeme",
  "secret", "default", "temp123", "test123", "abc123", "abcd1234",
  "111111", "000000", "123456", "654321",
  // Brand and project names — the passwords this deployment invites.
  "dudhat", "dhudhat", "def123",
];

export interface PolicyFailure {
  field: string;
  message: string;
}

interface PolicyContext {
  /** Rejected if the password contains the local part — "ramesh@x" / "ramesh". */
  email?: string;
  name?: string;
}

/**
 * Returns every failure rather than the first, so the user fixes the
 * password once instead of discovering rules one at a time.
 */
export function checkPassword(
  password: string,
  context: PolicyContext = {}
): PolicyFailure[] {
  const failures: PolicyFailure[] = [];
  const field = "newPassword";

  if (password.length < MIN_LENGTH) {
    failures.push({
      field,
      message: `Password must be at least ${MIN_LENGTH} characters.`,
    });
  }

  if (password.length > MAX_LENGTH) {
    failures.push({ field, message: "Password is too long." });
  }

  const normalised = password.toLowerCase().trim();

  // Strip separators first, so "p-a-s-s-w-o-r-d-1" is caught too.
  const condensed = normalised.replace(/[\s._-]/g, "");
  const stem = COMMON_STEMS.find(
    (s) => normalised.includes(s) || condensed.includes(s)
  );
  if (stem) {
    failures.push({
      field,
      message: `That password contains "${stem}", which is too predictable. Choose something else.`,
    });
  }

  // A single repeated character reaches any length requirement while
  // carrying almost no entropy.
  if (/^(.)\1+$/.test(password)) {
    failures.push({ field, message: "Password cannot be a single repeated character." });
  }

  if (isSequential(normalised)) {
    failures.push({
      field,
      message: "Password cannot be a simple sequence.",
    });
  }

  const localPart = context.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && normalised.includes(localPart)) {
    failures.push({
      field,
      message: "Password cannot contain your email address.",
    });
  }

  const firstName = context.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (firstName && firstName.length >= 3 && normalised.includes(firstName)) {
    failures.push({ field, message: "Password cannot contain your name." });
  }

  return failures;
}

/** "abcdefghijkl" or "123456789012" — long but trivially guessed. */
function isSequential(value: string): boolean {
  if (value.length < 4) return false;
  let ascending = true;
  let descending = true;

  for (let i = 1; i < value.length; i += 1) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (delta !== 1) ascending = false;
    if (delta !== -1) descending = false;
    if (!ascending && !descending) return false;
  }

  return ascending || descending;
}
