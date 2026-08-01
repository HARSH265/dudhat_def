import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import { CONTENT_STATUSES, seoMetaSchema, type ContentStatus, type ISeoMeta } from "./shared";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  displayOrder: number;
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

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    image: { type: Schema.Types.ObjectId, ref: "Media" },
    // One level of nesting only. Deeper trees break breadcrumbs and the
    // sitemap, and the catalogue does not need them.
    // docs/DATABASE_ARCHITECTURE.md §5.3
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    displayOrder: { type: Number, default: 0 },
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

// Partial so a soft-deleted category does not hold its slug hostage.
categorySchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
categorySchema.index({ status: 1, displayOrder: 1 });
categorySchema.index({ parentId: 1, displayOrder: 1 });
categorySchema.index({ isDeleted: 1 });

export const Category: Model<ICategory> = mongoose.model<ICategory>(
  "Category",
  categorySchema
);
export default Category;
