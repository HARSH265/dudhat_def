import type { Types } from "mongoose";
import { logger } from "../config/logger";
import { mediaRepository } from "../repositories/media.repository";
import type { IProduct } from "../models/Product";
import type { ICategory } from "../models/Category";

/**
 * Keeps Media.usageCount honest, which is what makes the delete guard in
 * media.service real. Before 2C, usageCount was only ever incremented by a
 * function nothing called.
 *
 * Deliberately NOT transactional. The count is a safety guard, not financial
 * data, and MongoDB transactions would couple every product write to a
 * replica-set session for no proportionate benefit. Instead the ordering is
 * chosen so the failure mode is safe, and `npm run reconcile:media` repairs
 * drift.
 *
 * Safe failure direction: a count that is too HIGH blocks a legitimate
 * delete (annoying, recoverable). Too LOW allows deleting an asset that is
 * still referenced, leaving broken images on the live site. So increments
 * happen before the write is acknowledged and decrements after.
 */

/** Every media reference a product can hold. */
export function collectProductMediaIds(
  product: Pick<
    IProduct,
    "primaryImage" | "gallery" | "brochure" | "certificates" | "packaging" | "seo"
  >
): string[] {
  const ids: (Types.ObjectId | undefined)[] = [
    product.primaryImage,
    product.brochure,
    product.seo?.ogImage,
    ...(product.gallery ?? []),
    ...(product.certificates ?? []),
    ...(product.packaging ?? []).flatMap((v) => [v.image, v.packagingImage]),
  ];

  // A product may legitimately use one asset in two slots (primary image and
  // OG image, typically). Counting it twice would make the asset
  // undeletable even after the product is gone, so references are unique.
  return [...new Set(ids.filter(Boolean).map((id) => String(id)))];
}

export function collectCategoryMediaIds(
  category: Pick<ICategory, "image" | "seo">
): string[] {
  const ids = [category.image, category.seo?.ogImage];
  return [...new Set(ids.filter(Boolean).map((id) => String(id)))];
}

/**
 * Applies the difference between two reference sets. Assets present in both
 * are untouched — incrementing and decrementing them would be a no-op with
 * two chances to fail.
 */
export async function applyUsageDiff(
  before: string[],
  after: string[]
): Promise<void> {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);

  const added = after.filter((id) => !beforeSet.has(id));
  const removed = before.filter((id) => !afterSet.has(id));

  for (const id of added) {
    await safeAdjust(id, 1);
  }
  for (const id of removed) {
    await safeAdjust(id, -1);
  }
}

export async function incrementUsage(ids: string[]): Promise<void> {
  await applyUsageDiff([], ids);
}

export async function releaseUsage(ids: string[]): Promise<void> {
  await applyUsageDiff(ids, []);
}

/**
 * A usage-count failure must never fail the content operation the user asked
 * for — but it must be visible, because it means the count has drifted.
 */
async function safeAdjust(id: string, by: number): Promise<void> {
  try {
    await mediaRepository.incrementUsage(
      id as unknown as Types.ObjectId,
      by
    );
  } catch (error) {
    logger.error(
      { err: error, mediaId: id, by },
      "usageCount adjustment failed — run reconcile:media"
    );
  }
}
