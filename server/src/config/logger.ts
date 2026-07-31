import pino from "pino";
import { env, isProduction } from "./env";

/**
 * Secrets and PII must never reach a log.
 * docs/SECURITY_ARCHITECTURE.md §5, §8, §11
 *
 * Lead field values are redacted deliberately: a lead's name, email, phone
 * and message are personal data with no operational reason to sit in an
 * application log. Lead IDs are fine.
 */
const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.password",
  "req.body.currentPassword",
  "req.body.newPassword",
  "req.body.token",
  "req.body.name",
  "req.body.email",
  "req.body.phone",
  "req.body.company",
  "req.body.message",
  "res.headers['set-cookie']",
  "*.passwordHash",
  "*.tokenHash",
  "*.secret",
  "*.mongoUri",
];

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? (isProduction ? "info" : "debug"),
  redact: { paths: redactPaths, censor: "[REDACTED]" },
  base: { env: env.nodeEnv },
  // Human-readable timestamps cost nothing here and save time in a terminal.
  timestamp: pino.stdTimeFunctions.isoTime,
});
