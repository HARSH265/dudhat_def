import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * bcryptjs rather than native bcrypt: this environment blocks native
 * postinstall scripts, and a broken native dependency on a host is a worse
 * outcome than a slower pure-JS KDF. Cost 12 per
 * docs/SECURITY_ARCHITECTURE.md §3.
 */
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Opaque refresh token. Only its hash is ever persisted. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Hashes an IP before storage. The raw address is used in-request for rate
 * limiting and then discarded — it is personal data with no retention
 * justification. docs/SECURITY_ARCHITECTURE.md §8
 */
export function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  const salt = process.env["IP_HASH_SALT"] ?? "dhudhat-dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Constant-time comparison for secrets of equal expected length. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
