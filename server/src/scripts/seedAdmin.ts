import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import { randomBytes } from "node:crypto";
import { connectDB, disconnectDB } from "../config/db";
import { userRepository } from "../repositories/user.repository";
import { authService } from "../services/auth.service";

/**
 * Creates the first superadmin.
 *
 * The password is generated, printed once, and never stored in the repo or
 * defaulted. A seeded admin/admin123 survives to production precisely
 * because it works. docs/SEED_DATA.md §5
 *
 * Usage: npm run seed:admin -- <email> "<name>"
 */
async function main(): Promise<void> {
  const email = process.argv[2];
  const name = process.argv[3] ?? "Administrator";

  if (!email) {
    console.error('Usage: npm run seed:admin -- <email> "<name>"');
    process.exit(1);
  }

  await connectDB();

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    console.error(`A user with email ${email} already exists. Nothing changed.`);
    await disconnectDB();
    process.exit(1);
  }

  const password = randomBytes(18).toString("base64url");
  const user = await authService.createUser({
    name,
    email,
    password,
    role: "superadmin",
  });

  console.log("\n  Superadmin created.\n");
  console.log(`  Email:    ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log("\n  Store this now — it is not recoverable.\n");

  await disconnectDB();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
