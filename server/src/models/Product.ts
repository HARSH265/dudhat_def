import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { CONTENT_STATUSES, seoMetaSchema, type ContentStatus, type ISeoMeta } from "./shared";

export const CONTAINER_TYPES = ["can", "drum", "ibc", "bottle", "tanker"] as const;
export type ContainerType = (typeof CONTAINER_TYPES)[number];

export const VOLUME_UNITS = ["L", "mL", "kg"] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export interface ISpecItem {
  group?: string;
  label: string;
  /**
   * String, not number. DEF specifications are expressed as ranges
   * ("1.087 – 1.093") and limits ("Max 0.3") far more often than as single
   * values. docs/PRODUCT_DATA_MODEL.md §4.3
   */
  value: string;
  unit?: string;
  standard?: string;
  order?: number;
  isKey?: boolean;
  /**
   * Marks a value that is a published standard limit rather than a measured
   * result from this product's Certificate of Analysis. The publish gate
   * refuses any product still carrying one — publishing a limit as though it
   * were a test result misstates the product to buyers who purchase on
   * specification. docs/SEED_DATA.md § Launch Gate
   */
  isPlaceholder?: boolean;
}

export interface IPackagingVariant {
  label: string;
  slug: string;
  volume: number;
  unit: VolumeUnit;
  containerType: ContainerType;
  material?: string;
  sku?: string;
  image?: Types.ObjectId;
  packagingImage?: Types.ObjectId;
  grossWeight?: number;
  unitsPerPallet?: number;
  moq?: string;
  features?: string[];
  isAvailable: boolean;
  displayOrder: number;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  sku?: string;
  tagline?: string;
  categoryId: Types.ObjectId;
  categoryName?: string;
  shortDescription?: string;
  description?: string;
  highlights: string[];
  badges: string[];
  specifications: ISpecItem[];
  packaging: IPackagingVariant[];
  applications: string[];
  primaryImage?: Types.ObjectId;
  gallery: Types.ObjectId[];
  brochure?: Types.ObjectId;
  certificates: Types.ObjectId[];
  isFeatured: boolean;
  displayOrder: number;
  relatedProductIds: Types.ObjectId[];
  viewCount: number;
  inquiryCount: number;
  brochureDownloads: number;
  status: ContentStatus;
  publishedAt?: Date;
  seo?: ISeoMeta;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const specItemSchema = new Schema<ISpecItem>(
  {
    group: { type: String, trim: true, maxlength: 60 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: String, required: true, trim: true, maxlength: 200 },
    unit: { type: String, trim: true, maxlength: 40 },
    standard: { type: String, trim: true, maxlength: 60 },
    order: { type: Number, default: 0 },
    isKey: { type: Boolean, default: false },
    isPlaceholder: { type: Boolean, default: false },
  },
  { _id: false }
);

const packagingVariantSchema = new Schema<IPackagingVariant>(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 80 },
    volume: { type: Number, required: true, min: 0.001 },
    unit: { type: String, enum: VOLUME_UNITS, required: true },
    containerType: { type: String, enum: CONTAINER_TYPES, required: true },
    material: { type: String, trim: true, maxlength: 60 },
    sku: { type: String, trim: true, uppercase: true, maxlength: 40 },
    image: { type: Schema.Types.ObjectId, ref: "Media" },
    // Left unpopulated: the current packaging/*.png files are byte-identical
    // to products/*.png. docs/SEED_DATA.md §1
    packagingImage: { type: Schema.Types.ObjectId, ref: "Media" },
    grossWeight: { type: Number, min: 0 },
    unitsPerPallet: { type: Number, min: 0 },
    moq: { type: String, trim: true, maxlength: 60 },
    features: [{ type: String, trim: true, maxlength: 60 }],
    isAvailable: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
    sku: { type: String, trim: true, uppercase: true, maxlength: 40 },
    tagline: { type: String, trim: true, maxlength: 120 },

    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    // Denormalised so listing endpoints avoid a populate. Refreshed by the
    // service on write; never trusted for authorisation.
    categoryName: { type: String, trim: true },

    shortDescription: { type: String, trim: true, maxlength: 300 },
    description: { type: String, maxlength: 20000 },
    highlights: [{ type: String, trim: true, maxlength: 200 }],
    badges: [{ type: String, trim: true, maxlength: 60 }],

    specifications: [specItemSchema],
    packaging: [packagingVariantSchema],
    applications: [{ type: String, trim: true, maxlength: 80 }],

    primaryImage: { type: Schema.Types.ObjectId, ref: "Media" },
    gallery: [{ type: Schema.Types.ObjectId, ref: "Media" }],
    brochure: { type: Schema.Types.ObjectId, ref: "Media" },
    certificates: [{ type: Schema.Types.ObjectId, ref: "Media" }],

    isFeatured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    relatedProductIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],

    // $inc only, never read-modify-write.
    viewCount: { type: Number, default: 0, min: 0 },
    inquiryCount: { type: Number, default: 0, min: 0 },
    brochureDownloads: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: CONTENT_STATUSES, default: "draft" },
    publishedAt: { type: Date },
    seo: { type: seoMetaSchema, default: () => ({}) },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

productSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
productSchema.index({ status: 1, displayOrder: 1 });
productSchema.index({ categoryId: 1, status: 1, displayOrder: 1 });
productSchema.index({ isFeatured: 1, status: 1 });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ isDeleted: 1 });
// One text index per collection is the MongoDB limit.
productSchema.index({
  name: "text",
  shortDescription: "text",
  applications: "text",
});

export const Product: Model<IProduct> = mongoose.model<IProduct>(
  "Product",
  productSchema
);
export default Product;
