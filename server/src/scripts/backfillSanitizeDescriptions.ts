import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db";
import { registerModels, Product } from "../models";
import { sanitizeRichText } from "../utils/richText";

/**
 * SECURITY_TODO S1 backfill.
 *
 * Rows written before sanitisation shipped hold unsanitised HTML. The first
 * surface that renders `description` inherits stored XSS from every one of
 * them, so they must be cleaned rather than left to the render path.
 *
 * Idempotent — re-running a clean database reports no changes.
 *
 * Usage: npm run backfill:sanitize [--apply]
 * Without --apply it reports what would change and writes nothing.
 */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  await connectDB();
  registerModels();

  // trusted(): this is `find`, which applies sanitizeFilter's $eq wrapping and
  // would fail to cast the operator object against the String path.
  // docs/MONGOOSE_GOTCHAS.md §1 — caught by that document's own audit rule.
  const products = await Product.find({
    description: mongoose.trusted({ $nin: [null, ""] }),
  })
    .select("name slug description")
    .lean();

  let changed = 0;

  for (const product of products) {
    const before = (product as { description?: string }).description ?? "";
    const after = sanitizeRichText(before);
    if (before === after) continue;

    changed += 1;
    const name = (product as { name?: string }).name ?? String(product._id);
    console.log(`  ${name}: ${before.length} -> ${after.length} chars`);

    if (apply) {
      await Product.updateOne({ _id: product._id }, { $set: { description: after } });
    }
  }

  console.log(
    changed === 0
      ? `\nNo changes. ${products.length} product(s) checked; all descriptions already clean.`
      : `\n${changed} of ${products.length} product(s) ${apply ? "sanitised." : "would change. Re-run with --apply."}`
  );

  await disconnectDB();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
