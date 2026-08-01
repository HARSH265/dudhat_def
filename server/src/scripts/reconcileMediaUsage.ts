import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import { connectDB, disconnectDB } from "../config/db";
import { registerModels, Media, Product, Category } from "../models";
import {
  collectCategoryMediaIds,
  collectProductMediaIds,
} from "../services/mediaUsage.service";

/**
 * Recomputes Media.usageCount from actual references.
 *
 * usageCount is maintained incrementally on every catalogue write, which is
 * fast but drifts if a process dies mid-update. It is a safety guard rather
 * than financial data, so the design choice is: no transactions, plus this
 * idempotent repair. Run it after an incident, or on a schedule.
 *
 * Usage: npm run reconcile:media [--apply]
 * Without --apply it reports drift and changes nothing.
 */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  await connectDB();
  registerModels();

  const counts = new Map<string, number>();

  const products = await Product.find({ isDeleted: false }).lean();
  for (const product of products) {
    for (const id of collectProductMediaIds(product as never)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const categories = await Category.find({ isDeleted: false }).lean();
  for (const category of categories) {
    for (const id of collectCategoryMediaIds(category as never)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const media = await Media.find({ isDeleted: false }).lean();
  let drift = 0;

  for (const asset of media) {
    const id = String((asset as { _id: unknown })._id);
    const actual = counts.get(id) ?? 0;
    const stored = (asset as { usageCount?: number }).usageCount ?? 0;

    if (actual === stored) continue;
    drift += 1;

    const filename = (asset as { filename?: string }).filename ?? id;
    console.log(`  ${filename}: stored ${stored} -> actual ${actual}`);

    if (apply) {
      await Media.updateOne({ _id: id }, { $set: { usageCount: actual } });
    }
  }

  if (drift === 0) {
    console.log(`No drift. ${media.length} asset(s) checked.`);
  } else {
    console.log(
      `\n${drift} asset(s) with drift${apply ? " — corrected." : ". Re-run with --apply to fix."}`
    );
  }

  await disconnectDB();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
