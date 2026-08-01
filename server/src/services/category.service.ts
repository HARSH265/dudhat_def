import type { Types } from "mongoose";
import {
  categoryRepository,
  productRepository,
} from "../repositories/catalogue.repository";
import { mediaRepository } from "../repositories/media.repository";
import { auditService } from "./audit.service";
import {
  applyUsageDiff,
  collectCategoryMediaIds,
  incrementUsage,
  releaseUsage,
} from "./mediaUsage.service";
import { toCategoryDoc } from "./catalogueMapper";
import { AppError, ErrorCode } from "../utils/AppError";
import { slugify } from "../utils/slug";
import type { ICategory } from "../models/Category";
import type { ContentStatus } from "../models/shared";
import type { Paged } from "../repositories/lead.repository";
import type {
  CategoryListQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../validators/catalogue.validator";

interface Actor {
  userId: Types.ObjectId;
}

export const categoryService = {
  async list(q: CategoryListQuery): Promise<Paged<ICategory>> {
    return categoryRepository.list(q);
  },

  async get(id: string): Promise<ICategory> {
    const category = await categoryRepository.findById(id);
    if (!category) throw AppError.notFound("Category not found.");
    return category;
  },

  async create(input: CreateCategoryInput, actor: Actor): Promise<ICategory> {
    const slug = input.slug ?? slugify(input.name);
    if (await categoryRepository.slugExists(slug)) {
      throw AppError.conflict(
        `The slug "${slug}" is already in use.`,
        ErrorCode.DUPLICATE_SLUG
      );
    }

    await assertParentValid(input.parentId ?? null);
    await assertMediaExists([input.image, input.seo?.ogImage]);

    const category = await categoryRepository.create({
      ...toCategoryDoc(input),
      slug,
      status: "draft",
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });

    await incrementUsage(collectCategoryMediaIds(category));

    await auditService.record({
      userId: actor.userId,
      action: "create",
      entityType: "category",
      entityId: category._id,
      changes: { name: category.name, slug: category.slug },
    });

    return category;
  },

  async update(
    id: string,
    input: UpdateCategoryInput,
    actor: Actor
  ): Promise<ICategory> {
    const current = await categoryRepository.findById(id);
    if (!current) throw AppError.notFound("Category not found.");

    const patch: Partial<ICategory> = toCategoryDoc(input);

    if (input.slug && input.slug !== current.slug) {
      // Slugs are immutable once published. DATABASE_ARCHITECTURE §9 calls for
      // a 301 redirect on change, but the `redirects` collection is Phase 3 —
      // so the change is refused rather than silently breaking inbound links.
      if (current.status === "published") {
        throw AppError.conflict(
          "The slug of a published category cannot be changed yet. Unpublish it first, or wait for redirect support.",
          ErrorCode.DUPLICATE_SLUG
        );
      }
      if (await categoryRepository.slugExists(input.slug, id)) {
        throw AppError.conflict(
          `The slug "${input.slug}" is already in use.`,
          ErrorCode.DUPLICATE_SLUG
        );
      }
    }

    if (input.parentId !== undefined) {
      if (input.parentId === id) {
        throw AppError.badRequest("A category cannot be its own parent.");
      }
      await assertParentValid(input.parentId, id);
    }

    await assertMediaExists([input.image, input.seo?.ogImage]);

    patch.updatedBy = actor.userId;
    const updated = await categoryRepository.update(id, patch);
    if (!updated) throw AppError.notFound("Category not found.");

    await applyUsageDiff(
      collectCategoryMediaIds(current),
      collectCategoryMediaIds(updated)
    );

    // A rename must propagate to the denormalised copy on every product.
    if (input.name && input.name !== current.name) {
      await productRepository.refreshCategoryName(id, updated.name);
    }

    await auditService.record({
      userId: actor.userId,
      action: "update",
      entityType: "category",
      entityId: updated._id,
      changes: diffKeys(current as unknown as Record<string, unknown>, patch as Record<string, unknown>),
    });

    return updated;
  },

  async setStatus(
    id: string,
    status: ContentStatus,
    actor: Actor
  ): Promise<ICategory> {
    const current = await categoryRepository.findById(id);
    if (!current) throw AppError.notFound("Category not found.");

    if (status === "archived") {
      const blocking = await productRepository.listPublishedInCategory(id);
      if (blocking.length > 0) {
        throw AppError.conflict(
          `${blocking.length} published product${blocking.length === 1 ? " still uses" : "s still use"} this category: ${blocking
            .map((p) => p.name)
            .slice(0, 5)
            .join(", ")}.`,
          ErrorCode.RESOURCE_IN_USE
        );
      }
    }

    const patch: Partial<ICategory> = { status, updatedBy: actor.userId };
    if (status === "published" && !current.publishedAt) {
      patch.publishedAt = new Date();
    }

    const updated = await categoryRepository.update(id, patch);
    if (!updated) throw AppError.notFound("Category not found.");

    await auditService.record({
      userId: actor.userId,
      action: status === "published" ? "publish" : "unpublish",
      entityType: "category",
      entityId: updated._id,
      changes: { status: { from: current.status, to: status } },
    });

    return updated;
  },

  async remove(id: string, actor: Actor): Promise<void> {
    const category = await categoryRepository.findById(id);
    if (!category) throw AppError.notFound("Category not found.");

    const productCount = await productRepository.countInCategory(id);
    if (productCount > 0) {
      throw AppError.conflict(
        `${productCount} product${productCount === 1 ? "" : "s"} still reference this category.`,
        ErrorCode.RESOURCE_IN_USE
      );
    }

    const childCount = await categoryRepository.countChildren(id);
    if (childCount > 0) {
      throw AppError.conflict(
        `${childCount} child categor${childCount === 1 ? "y" : "ies"} still reference this category.`,
        ErrorCode.RESOURCE_IN_USE
      );
    }

    await categoryRepository.softDelete(id, actor.userId);
    await releaseUsage(collectCategoryMediaIds(category));

    await auditService.record({
      userId: actor.userId,
      action: "delete",
      entityType: "category",
      entityId: category._id,
      changes: { name: category.name },
    });
  },
};

/** One level of nesting only. docs/DATABASE_ARCHITECTURE.md §5.3 */
async function assertParentValid(
  parentId: string | null | undefined,
  selfId?: string
): Promise<void> {
  if (!parentId) return;

  const parent = await categoryRepository.findById(parentId);
  if (!parent) throw AppError.badRequest("Parent category not found.");
  if (selfId && String(parent._id) === selfId) {
    throw AppError.badRequest("A category cannot be its own parent.");
  }
  if (parent.parentId) {
    throw AppError.badRequest(
      "Categories support one level of nesting. That parent is already a child."
    );
  }
}

/**
 * MongoDB has no foreign keys, so referential integrity is enforced here.
 * docs/DATABASE_ARCHITECTURE.md §9
 */
async function assertMediaExists(
  ids: (string | undefined | null)[]
): Promise<void> {
  for (const id of ids) {
    if (!id) continue;
    const media = await mediaRepository.findById(id);
    if (!media) throw AppError.badRequest(`Media ${id} not found.`);
  }
}

function diffKeys(
  before: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    if (key === "updatedBy") continue;
    out[key] = { from: before[key], to: patch[key] };
  }
  return out;
}

export { assertMediaExists };
