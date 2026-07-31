import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const MEDIA_FOLDERS = [
  "products",
  "packaging",
  "general",
  "logo",
  "documents",
] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export type MediaFileType = "image" | "document";

export interface IMedia extends Document {
  _id: Types.ObjectId;
  filename: string;
  provider: "cloudinary";
  publicId: string;
  url: string;
  mimeType: string;
  fileType: MediaFileType;
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
  tags: string[];
  folder: MediaFolder;
  checksum: string;
  /** Incremented when a document references this asset; blocks deletion. */
  usageCount: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    // Display label only. Never used to build a filesystem path or URL —
    // the stored name is regenerated server-side.
    filename: { type: String, required: true, trim: true, maxlength: 255 },
    provider: { type: String, enum: ["cloudinary"], default: "cloudinary" },
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileType: { type: String, enum: ["image", "document"], required: true },
    size: { type: Number, required: true, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    alt: { type: String, trim: true, maxlength: 300 },
    caption: { type: String, trim: true, maxlength: 500 },
    tags: [{ type: String, trim: true, maxlength: 50 }],
    folder: { type: String, enum: MEDIA_FOLDERS, default: "general" },
    checksum: { type: String, required: true },
    usageCount: { type: Number, default: 0, min: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

mediaSchema.index({ folder: 1, createdAt: -1 });
mediaSchema.index({ tags: 1 });
// Duplicate detection on upload — same bytes, same asset.
mediaSchema.index({ checksum: 1 });
mediaSchema.index({ publicId: 1 }, { sparse: true });
mediaSchema.index({ isDeleted: 1 });
mediaSchema.index({
  filename: "text",
  alt: "text",
  caption: "text",
  tags: "text",
});

export const Media: Model<IMedia> = mongoose.model<IMedia>("Media", mediaSchema);
export default Media;
