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

const nodeEnv = optional("NODE_ENV", "development");
const inProduction = nodeEnv === "production";

/**
 * Secrets are mandatory in production. In development a missing secret falls
 * back to an ephemeral random value so the server still boots — tokens then
 * become invalid on every restart, which is acceptable locally and loud
 * enough to notice. docs/SECURITY_ARCHITECTURE.md §5
 */
function secret(key: string): string {
  const value = process.env[key];
  if (value && value.trim() !== "") return value;

  if (inProduction) {
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
} as const;

export const isProduction = inProduction;
