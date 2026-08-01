import { z } from "zod";
import { CONTENT_STATUSES } from "../models/shared";
import { CONTAINER_TYPES, VOLUME_UNITS } from "../models/Product";
import { isValidSlug } from "../utils/slug";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier.");

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidSlug, "Slug must be lowercase, hyphen-separated, no spaces.");

const seoSchema = z
  .object({
    metaTitle: z.string().trim().max(70).optional(),
    metaDescription: z.string().trim().max(200).optional(),
    canonicalUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
    ogTitle: z.string().trim().max(70).optional(),
    ogDescription: z.string().trim().max(200).optional(),
    ogImage: objectId.optional(),
    ogType: z.enum(["website", "article", "product"]).optional(),
    twitterCard: z.enum(["summary", "summary_large_image"]).optional(),
    keywords: z.array(z.string().trim().max(60)).max(15).optional(),
    schemaType: z
      .enum(["Organization", "Product", "WebPage", "BreadcrumbList", "FAQPage"])
      .optional(),
    noIndex: z.boolean().optional(),
    noFollow: z.boolean().optional(),
  })
  .strip();

// --- Categories ---

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    slug: slug.optional(),
    description: z.string().trim().max(2000).optional(),
    image: objectId.optional(),
    parentId: objectId.nullable().optional(),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    seo: seoSchema.optional(),
  })
  .strip();

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

export const categoryListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.enum(CONTENT_STATUSES).optional(),
    parentId: objectId.optional(),
    search: z.string().trim().min(1).max(200).optional(),
  })
  .strip();

// --- Products ---

const specItemSchema = z
  .object({
    group: z.string().trim().max(60).optional(),
    label: z.string().trim().min(1, "Specification label is required.").max(120),
    value: z.string().trim().min(1, "Specification value is required.").max(200),
    unit: z.string().trim().max(40).optional(),
    standard: z.string().trim().max(60).optional(),
    order: z.number().int().min(0).max(999).optional(),
    isKey: z.boolean().optional(),
    isPlaceholder: z.boolean().optional(),
  })
  .strip();

const packagingVariantSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    slug: slug,
    volume: z.number().positive("Volume must be greater than zero."),
    unit: z.enum(VOLUME_UNITS),
    containerType: z.enum(CONTAINER_TYPES),
    material: z.string().trim().max(60).optional(),
    sku: z.string().trim().max(40).optional(),
    image: objectId.optional(),
    packagingImage: objectId.optional(),
    grossWeight: z.number().min(0).optional(),
    unitsPerPallet: z.number().int().min(0).optional(),
    moq: z.string().trim().max(60).optional(),
    features: z.array(z.string().trim().max(60)).max(10).optional(),
    isAvailable: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(999).optional(),
  })
  .strip();

export const createProductSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    slug: slug.optional(),
    sku: z.string().trim().max(40).optional(),
    tagline: z.string().trim().max(120).optional(),
    categoryId: objectId,
    shortDescription: z.string().trim().max(300).optional(),
    description: z.string().max(20000).optional(),
    highlights: z.array(z.string().trim().max(200)).max(6).optional(),
    badges: z.array(z.string().trim().max(60)).max(10).optional(),
    specifications: z.array(specItemSchema).max(60).optional(),
    packaging: z.array(packagingVariantSchema).max(20).optional(),
    applications: z.array(z.string().trim().max(80)).max(20).optional(),
    primaryImage: objectId.optional(),
    gallery: z.array(objectId).max(20).optional(),
    brochure: objectId.optional(),
    certificates: z.array(objectId).max(10).optional(),
    isFeatured: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    relatedProductIds: z.array(objectId).max(8).optional(),
    seo: seoSchema.optional(),
  })
  .strip()
  .superRefine((value, ctx) => {
    const slugs = (value.packaging ?? []).map((p) => p.slug);
    if (new Set(slugs).size !== slugs.length) {
      ctx.addIssue({
        code: "custom",
        path: ["packaging"],
        message: "Packaging variant slugs must be unique within a product.",
      });
    }
  });

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    slug: slug.optional(),
    sku: z.string().trim().max(40).optional(),
    tagline: z.string().trim().max(120).optional(),
    categoryId: objectId.optional(),
    shortDescription: z.string().trim().max(300).optional(),
    description: z.string().max(20000).optional(),
    highlights: z.array(z.string().trim().max(200)).max(6).optional(),
    badges: z.array(z.string().trim().max(60)).max(10).optional(),
    specifications: z.array(specItemSchema).max(60).optional(),
    packaging: z.array(packagingVariantSchema).max(20).optional(),
    applications: z.array(z.string().trim().max(80)).max(20).optional(),
    primaryImage: objectId.nullable().optional(),
    gallery: z.array(objectId).max(20).optional(),
    brochure: objectId.nullable().optional(),
    certificates: z.array(objectId).max(10).optional(),
    isFeatured: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    relatedProductIds: z.array(objectId).max(8).optional(),
    seo: seoSchema.optional(),
  })
  .strip()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

export const productListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z
      .enum(["displayOrder", "-createdAt", "createdAt", "name", "-name"])
      .default("displayOrder"),
    status: z.enum(CONTENT_STATUSES).optional(),
    categoryId: objectId.optional(),
    featured: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    search: z.string().trim().min(1).max(200).optional(),
  })
  .strip();

export const statusSchema = z
  .object({ status: z.enum(CONTENT_STATUSES) })
  .strip();

export const reorderSchema = z
  .object({
    items: z
      .array(z.object({ id: objectId, displayOrder: z.number().int().min(0) }))
      .min(1)
      .max(200),
  })
  .strip();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
