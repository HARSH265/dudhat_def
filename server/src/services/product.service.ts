import type { Types } from "mongoose";
import {
  categoryRepository,
  productRepository,
} from "../repositories/catalogue.repository";
import { auditService } from "./audit.service";
import { assertMediaExists } from "./category.service";
import {
  applyUsageDiff,
  collectProductMediaIds,
  incrementUsage,
  releaseUsage,
} from "./mediaUsage.service";
import { toProductDoc } from "./catalogueMapper";
import { AppError, ErrorCode } from "../utils/AppError";
import { slugify } from "../utils/slug";
import type { IProduct } from "../models/Product";
import type { ContentStatus } from "../models/shared";
import type { Paged } from "../repositories/lead.repository";
import type {
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from "../validators/catalogue.validator";

interface Actor {
  userId: Types.ObjectId;
}

const PLACEHOLDER_MARKER = "[PLACEHOLDER]";

export const productService = {
  async list(q: ProductListQuery): Promise<Paged<IProduct>> {
    return productRepository.list(q);
  },

  async get(id: string): Promise<IProduct> {
    const product = await productRepository.findById(id);
    if (!product) throw AppError.notFound("Product not found.");
    return product;
  },

  async create(input: CreateProductInput, actor: Actor): Promise<IProduct> {
    const slug = input.slug ?? slugify(input.name);
    if (await productRepository.slugExists(slug)) {
      throw AppError.conflict(
        `The slug "${slug}" is already in use.`,
        ErrorCode.DUPLICATE_SLUG
      );
    }

    const category = await categoryRepository.findById(input.categoryId);
    if (!category) throw AppError.badRequest("Category not found.");

    await assertMediaExists(mediaRefsOf(input));

    const product = await productRepository.create({
      ...toProductDoc(input),
      slug,
      categoryName: category.name,
      status: "draft",
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });

    await incrementUsage(collectProductMediaIds(product));

    await auditService.record({
      userId: actor.userId,
      action: "create",
      entityType: "product",
      entityId: product._id,
      changes: { name: product.name, slug: product.slug },
    });

    return product;
  },

  async update(
    id: string,
    input: UpdateProductInput,
    actor: Actor
  ): Promise<IProduct> {
    const current = await productRepository.findById(id);
    if (!current) throw AppError.notFound("Product not found.");

    const patch: Partial<IProduct> = toProductDoc(input);

    if (input.slug && input.slug !== current.slug) {
      // See category.service — redirects are Phase 3, so a published slug is
      // frozen rather than silently breaking inbound links and indexed URLs.
      if (current.status === "published") {
        throw AppError.conflict(
          "The slug of a published product cannot be changed yet. Unpublish it first, or wait for redirect support.",
          ErrorCode.DUPLICATE_SLUG
        );
      }
      if (await productRepository.slugExists(input.slug, id)) {
        throw AppError.conflict(
          `The slug "${input.slug}" is already in use.`,
          ErrorCode.DUPLICATE_SLUG
        );
      }
    }

    if (input.categoryId && input.categoryId !== String(current.categoryId)) {
      const category = await categoryRepository.findById(input.categoryId);
      if (!category) throw AppError.badRequest("Category not found.");
      patch.categoryName = category.name;
    }

    await assertMediaExists(mediaRefsOf(input));

    patch.updatedBy = actor.userId;
    const updated = await productRepository.update(id, patch);
    if (!updated) throw AppError.notFound("Product not found.");

    await applyUsageDiff(
      collectProductMediaIds(current),
      collectProductMediaIds(updated)
    );

    await auditService.record({
      userId: actor.userId,
      action: "update",
      entityType: "product",
      entityId: updated._id,
      changes: Object.fromEntries(
        Object.keys(input).map((k) => [k, { changed: true }])
      ),
    });

    return updated;
  },

  /**
   * Publish gate. docs/API_SPECIFICATION.md §5.4, docs/SEED_DATA.md § Launch Gate
   *
   * Returns every failure at once rather than the first — a publish dialog
   * showing one problem at a time makes the editor guess how many remain.
   */
  async setStatus(
    id: string,
    status: ContentStatus,
    actor: Actor
  ): Promise<IProduct> {
    const current = await productRepository.findById(id);
    if (!current) throw AppError.notFound("Product not found.");

    if (status === "published") {
      const problems = publishBlockers(current);
      if (problems.length > 0) {
        throw AppError.unprocessable(
          "This product is not ready to publish.",
          problems
        );
      }
    }

    const patch: Partial<IProduct> = { status, updatedBy: actor.userId };
    if (status === "published" && !current.publishedAt) {
      patch.publishedAt = new Date();
    }

    const updated = await productRepository.update(id, patch);
    if (!updated) throw AppError.notFound("Product not found.");

    await auditService.record({
      userId: actor.userId,
      action: status === "published" ? "publish" : "unpublish",
      entityType: "product",
      entityId: updated._id,
      changes: { status: { from: current.status, to: status } },
    });

    return updated;
  },

  async reorder(
    items: { id: string; displayOrder: number }[],
    actor: Actor
  ): Promise<number> {
    const modified = await productRepository.bulkReorder(items);
    await auditService.record({
      userId: actor.userId,
      action: "update",
      entityType: "product",
      changes: { reordered: items.length },
    });
    return modified;
  },

  async duplicate(id: string, actor: Actor): Promise<IProduct> {
    const source = await productRepository.findById(id);
    if (!source) throw AppError.notFound("Product not found.");

    const base = `${source.slug}-copy`;
    let slug = base;
    let n = 2;
    while (await productRepository.slugExists(slug)) {
      slug = `${base}-${n++}`;
    }

    const copy = source.toObject() as Record<string, unknown>;
    delete copy["_id"];
    delete copy["createdAt"];
    delete copy["updatedAt"];
    delete copy["publishedAt"];

    const product = await productRepository.create({
      ...copy,
      name: `${source.name} (copy)`,
      slug,
      // A copy never inherits a published state, and counters start at zero.
      status: "draft",
      sku: undefined,
      viewCount: 0,
      inquiryCount: 0,
      brochureDownloads: 0,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    } as Partial<IProduct>);

    await incrementUsage(collectProductMediaIds(product));

    await auditService.record({
      userId: actor.userId,
      action: "create",
      entityType: "product",
      entityId: product._id,
      changes: { duplicatedFrom: String(source._id) },
    });

    return product;
  },

  async remove(id: string, actor: Actor): Promise<void> {
    const product = await productRepository.findById(id);
    if (!product) throw AppError.notFound("Product not found.");

    await productRepository.softDelete(id, actor.userId);
    await releaseUsage(collectProductMediaIds(product));

    await auditService.record({
      userId: actor.userId,
      action: "delete",
      entityType: "product",
      entityId: product._id,
      changes: { name: product.name },
    });
  },
};

/**
 * Everything that must be true before a product may go live. Half-populated
 * product pages are worse for SEO than no page, and placeholder
 * specifications are a factual misstatement about the product.
 */
function publishBlockers(product: IProduct): { field: string; message: string }[] {
  const problems: { field: string; message: string }[] = [];

  if (!product.primaryImage) {
    problems.push({ field: "primaryImage", message: "A primary image is required." });
  }
  if (!product.shortDescription?.trim()) {
    problems.push({
      field: "shortDescription",
      message: "A short description is required.",
    });
  }
  if (!product.specifications || product.specifications.length === 0) {
    problems.push({
      field: "specifications",
      message: "At least one specification is required.",
    });
  }
  if (!product.packaging?.some((v) => v.isAvailable)) {
    problems.push({
      field: "packaging",
      message: "At least one available packaging variant is required.",
    });
  }

  // The launch gate. Placeholder specs are ISO published limits, not this
  // product's measured results — publishing them as results would misstate
  // the product to buyers who purchase on specification.
  const placeholderSpecs = (product.specifications ?? []).filter(
    (s) => s.isPlaceholder
  );
  if (placeholderSpecs.length > 0) {
    problems.push({
      field: "specifications",
      message: `${placeholderSpecs.length} specification${placeholderSpecs.length === 1 ? " is" : "s are"} still marked as placeholder (${placeholderSpecs
        .map((s) => s.label)
        .slice(0, 3)
        .join(", ")}). Replace with Certificate of Analysis values.`,
    });
  }

  // Badges are compliance claims. "[PLACEHOLDER] ISO 22241" asserts a
  // certification that has not been evidenced.
  const placeholderText = [
    ...(product.badges ?? []).map((b) => ({ field: "badges", value: b })),
    { field: "tagline", value: product.tagline ?? "" },
    { field: "shortDescription", value: product.shortDescription ?? "" },
  ].filter((x) => x.value.includes(PLACEHOLDER_MARKER));

  for (const item of placeholderText) {
    problems.push({
      field: item.field,
      message: `Still contains ${PLACEHOLDER_MARKER}: "${item.value}".`,
    });
  }

  return problems;
}

/**
 * Every media id a payload references, for existence checking. Accepts null
 * because an update uses it to clear a reference; nulls are filtered by the
 * caller's existence check.
 */
function mediaRefsOf(
  input: CreateProductInput | UpdateProductInput
): (string | undefined | null)[] {
  return [
    input.primaryImage,
    input.brochure,
    input.seo?.ogImage,
    ...(input.gallery ?? []),
    ...(input.certificates ?? []),
    ...(input.packaging ?? []).flatMap((v) => [v.image, v.packagingImage]),
  ];
}
