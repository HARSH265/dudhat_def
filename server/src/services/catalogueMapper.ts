import mongoose, { type Types } from "mongoose";
import type { IProduct } from "../models/Product";
import type { ICategory } from "../models/Category";
import type { ISeoMeta } from "../models/shared";
import type {
  CreateCategoryInput,
  CreateProductInput,
  UpdateCategoryInput,
  UpdateProductInput,
} from "../validators/catalogue.validator";

/**
 * Validators produce plain strings for identifiers; models expect ObjectIds.
 * Converting explicitly here keeps the cast in one auditable place rather
 * than scattering `as unknown as` through the services.
 *
 * `null` means "clear this reference" and is preserved — the media usage
 * collector treats it as absent, so the count decrements correctly.
 */

function oid(value: string): Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

function oidOrNull(value: string | null | undefined): Types.ObjectId | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return oid(value);
}

function mapSeo(seo: CreateProductInput["seo"]): ISeoMeta | undefined {
  if (!seo) return undefined;
  const { ogImage, ...rest } = seo;
  return {
    ...rest,
    ...(ogImage ? { ogImage: oid(ogImage) } : {}),
  } as ISeoMeta;
}

export function toProductDoc(
  input: CreateProductInput | UpdateProductInput
): Partial<IProduct> {
  const {
    categoryId,
    primaryImage,
    brochure,
    gallery,
    certificates,
    packaging,
    relatedProductIds,
    seo,
    ...rest
  } = input as CreateProductInput & UpdateProductInput;

  const doc: Partial<IProduct> = { ...rest } as Partial<IProduct>;

  if (categoryId !== undefined) doc.categoryId = oid(categoryId);
  if (primaryImage !== undefined) {
    doc.primaryImage = oidOrNull(primaryImage) as Types.ObjectId;
  }
  if (brochure !== undefined) {
    doc.brochure = oidOrNull(brochure) as Types.ObjectId;
  }
  if (gallery !== undefined) doc.gallery = gallery.map(oid);
  if (certificates !== undefined) doc.certificates = certificates.map(oid);
  if (relatedProductIds !== undefined) {
    doc.relatedProductIds = relatedProductIds.map(oid);
  }
  if (seo !== undefined) doc.seo = mapSeo(seo);

  if (packaging !== undefined) {
    doc.packaging = packaging.map((v) => ({
      ...v,
      isAvailable: v.isAvailable ?? true,
      displayOrder: v.displayOrder ?? 0,
      ...(v.image ? { image: oid(v.image) } : {}),
      ...(v.packagingImage ? { packagingImage: oid(v.packagingImage) } : {}),
    })) as IProduct["packaging"];
  }

  return doc;
}

export function toCategoryDoc(
  input: CreateCategoryInput | UpdateCategoryInput
): Partial<ICategory> {
  const { image, parentId, seo, ...rest } = input as CreateCategoryInput &
    UpdateCategoryInput;

  const doc: Partial<ICategory> = { ...rest } as Partial<ICategory>;

  if (image !== undefined) doc.image = oidOrNull(image) as Types.ObjectId;
  if (parentId !== undefined) doc.parentId = oidOrNull(parentId);
  if (seo !== undefined) doc.seo = mapSeo(seo as CreateProductInput["seo"]);

  return doc;
}
