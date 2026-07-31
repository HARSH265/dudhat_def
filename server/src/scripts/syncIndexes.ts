import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import { connectDB, disconnectDB } from "../config/db";
import { registerModels, MODELS } from "../models";

/**
 * Phase 1 review H1.
 *
 * `autoIndex` is disabled in production, so nothing creates indexes there.
 * Without this step a production database has no indexes at all — which is
 * not only a performance problem: Mongoose's `unique: true` is an index
 * directive, not a validator, so duplicate lead numbers and duplicate user
 * emails become possible, and both TTL retention policies silently never run.
 *
 * Run as a deploy step, before the server starts.
 *
 * syncIndexes() is idempotent: it creates what is missing and drops indexes
 * that are no longer declared in the schema.
 */
async function main(): Promise<void> {
  await connectDB();
  registerModels();

  for (const [name, model] of Object.entries(MODELS)) {
    const before = await safeIndexCount(model);
    await model.syncIndexes();
    const after = await safeIndexCount(model);
    const delta = after - before;
    const suffix = delta === 0 ? "unchanged" : `${delta > 0 ? "+" : ""}${delta}`;
    console.log(`  ${name.padEnd(14)} ${String(after).padStart(2)} indexes (${suffix})`);
  }

  console.log("\nIndex sync complete.");
  await disconnectDB();
}

async function safeIndexCount(model: { collection: { indexes: () => Promise<unknown[]> } }): Promise<number> {
  try {
    return (await model.collection.indexes()).length;
  } catch {
    // Collection does not exist yet; syncIndexes will create it.
    return 0;
  }
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
