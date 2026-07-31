import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db";
import Lead from "../models/Lead";
import LeadActivity from "../models/LeadActivity";
import { nextSequence } from "../models/Counter";
import { normalisePhone } from "../utils/phone";

/**
 * Migration M1: contacts -> leads. docs/DATABASE_ARCHITECTURE.md §8
 *
 * Idempotent and additive. `contacts` is left untouched as a rollback path;
 * it is not dropped. Re-running skips anything already migrated.
 */
async function main(): Promise<void> {
  await connectDB();

  const contacts = mongoose.connection.collection("contacts");
  const docs = await contacts.find({}).sort({ createdAt: 1 }).toArray();

  console.log(`Found ${docs.length} contact(s) to migrate.`);

  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    // Match on the original _id so a re-run cannot duplicate.
    const existing = await Lead.findOne({ "utm.migratedFrom": String(doc["_id"]) });
    if (existing) {
      skipped += 1;
      continue;
    }

    const createdAt = (doc["createdAt"] as Date | undefined) ?? new Date();
    const year = createdAt.getUTCFullYear();
    const seq = await nextSequence(`lead-${year}`);

    const lead = await Lead.create({
      leadNumber: `DEF-${year}-${String(seq).padStart(5, "0")}`,
      name: doc["name"],
      email: doc["email"],
      // Phase 1 review M6: same normalisation the live path applies, so one
      // collection does not end up holding two phone formats.
      phone: normalisePhone(String(doc["phone"] ?? "")),
      company: doc["company"],
      message: doc["message"],
      type: "contact",
      status: "new",
      priority: "medium",
      source: "website",
      country: "India",
      isSpam: false,
      spamScore: 0,
      isDeleted: false,
      // Provenance, so a re-run is a no-op and the origin stays traceable.
      utm: { migratedFrom: String(doc["_id"]) },
      createdAt,
      updatedAt: (doc["updatedAt"] as Date | undefined) ?? createdAt,
    });

    await LeadActivity.create({
      leadId: lead._id,
      type: "created",
      note: "Migrated from the contacts collection.",
    });

    migrated += 1;
  }

  console.log(`Migrated: ${migrated}, skipped (already present): ${skipped}`);
  console.log("`contacts` left intact as a rollback path.");

  await disconnectDB();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
