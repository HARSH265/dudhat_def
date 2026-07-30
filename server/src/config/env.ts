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

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "5000")),

  mongoUri: required("MONGO_URI"),

  clientUrl: optional("CLIENT_URL", "http://localhost:3000"),
  adminUrl: optional("ADMIN_URL", "http://localhost:5173"),
} as const;

export const isProduction = env.nodeEnv === "production";
