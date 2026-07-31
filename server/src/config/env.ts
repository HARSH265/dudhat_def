import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Fail fast at boot with a named error instead of a TypeError forty lines
 * later. docs/SECURITY_ARCHITECTURE.md §5
 */
function required(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${key}. See server/.env.example`
    );
  }
  return value;
}

function optional(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== "" ? value : fallback;
}

const rawNodeEnv = process.env["NODE_ENV"]?.trim();

/**
 * Development conveniences require NODE_ENV to say "development" EXPLICITLY.
 *
 * Phase 1 review H2: this previously defaulted to "development" when NODE_ENV
 * was absent, so a production host that simply forgot to set it inherited
 * every development relaxation — ephemeral JWT secrets, an insecure cookie,
 * and internal IDs in error bodies. Absence of configuration must not grant
 * privilege, so an unset NODE_ENV is now treated as production.
 */
const isDevelopment = rawNodeEnv === "development" || rawNodeEnv === "test";
const nodeEnv = rawNodeEnv ?? "production";
const inProduction = !isDevelopment;

if (!rawNodeEnv) {
  console.warn(
    "[env] NODE_ENV is not set. Assuming production and enforcing production " +
      "rules. Set NODE_ENV=development in server/.env for local work."
  );
}

/**
 * Secrets are mandatory outside development. In development a missing secret
 * falls back to an ephemeral random value so the server still boots — tokens
 * then become invalid on every restart, which is acceptable locally and loud
 * enough to notice. docs/SECURITY_ARCHITECTURE.md §5
 */
function secret(key: string): string {
  const value = process.env[key];
  if (value && value.trim() !== "") return value;

  if (!isDevelopment) {
    throw new Error(
      `Missing required environment variable: ${key}. See server/.env.example`
    );
  }

  console.warn(
    `[env] ${key} is not set. Using an ephemeral development secret — ` +
      `sessions will not survive a restart. Add it to server/.env.`
  );
  return randomBytes(32).toString("base64");
}

/**
 * Phase 1 review H3: the IP hash salt previously had an in-source default,
 * which meant every deployment that forgot to set it salted with a constant
 * committed to git — making the hashes reversible and defeating the reason
 * for hashing. The development default is stable (so hashes are comparable
 * across restarts) but is only reachable when NODE_ENV says development.
 */
function saltValue(): string {
  const value = process.env["IP_HASH_SALT"];
  if (value && value.trim() !== "") return value;

  if (!isDevelopment) {
    throw new Error(
      "Missing required environment variable: IP_HASH_SALT. " +
        "See server/.env.example"
    );
  }

  console.warn("[env] IP_HASH_SALT is not set. Using the development salt.");
  return "development-only-ip-salt";
}

export const env = {
  nodeEnv,
  port: Number(optional("PORT", "5000")),

  mongoUri: required("MONGO_URI"),

  clientUrl: optional("CLIENT_URL", "http://localhost:3000"),
  adminUrl: optional("ADMIN_URL", "http://localhost:5173"),

  jwtAccessSecret: secret("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: secret("JWT_REFRESH_SECRET"),
  jwtAccessExpiry: optional("JWT_ACCESS_EXPIRY", "15m"),
  refreshTokenDays: Number(optional("REFRESH_TOKEN_DAYS", "7")),

  ipHashSalt: saltValue(),

  cloudinary: {
    cloudName: optional("CLOUDINARY_CLOUD_NAME", ""),
    apiKey: cloudinaryCredential("API_KEY"),
    apiSecret: cloudinaryCredential("API_SECRET"),
  },
} as const;

/**
 * Cloudinary's dashboard labels these "API Key" and "API Secret", so they
 * often land in .env unprefixed. Bare API_KEY / API_SECRET are generic enough
 * to collide with the next service added, so the prefixed names win and the
 * fallback warns.
 */
function cloudinaryCredential(suffix: "API_KEY" | "API_SECRET"): string {
  const prefixed = process.env[`CLOUDINARY_${suffix}`];
  if (prefixed && prefixed.trim() !== "") return prefixed;

  const bare = process.env[suffix];
  if (bare && bare.trim() !== "") {
    console.warn(
      `[env] Using ${suffix} for Cloudinary. Rename it to CLOUDINARY_${suffix} ` +
        `— a bare ${suffix} will collide with the next service you add.`
    );
    return bare;
  }
  return "";
}

/** Media uploads are unavailable rather than broken when unconfigured. */
export const isCloudinaryConfigured =
  env.cloudinary.cloudName !== "" &&
  env.cloudinary.apiKey !== "" &&
  env.cloudinary.apiSecret !== "";

export const isProduction = inProduction;
