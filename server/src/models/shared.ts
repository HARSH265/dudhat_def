import { Schema, type Types } from "mongoose";

/**
 * Reusable sub-documents. Defined once, embedded everywhere.
 * docs/DATABASE_ARCHITECTURE.md §4
 */

export interface ISeoMeta {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: Types.ObjectId;
  ogType?: "website" | "article" | "product";
  twitterCard?: "summary" | "summary_large_image";
  keywords?: string[];
  schemaType?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

/**
 * Empty fields are NOT persisted with computed values — the fallback chain
 * runs at read time so renaming a product updates its meta title.
 * docs/DATABASE_ARCHITECTURE.md §4.1
 */
export const seoMetaSchema = new Schema<ISeoMeta>(
  {
    metaTitle: { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 200 },
    canonicalUrl: { type: String, trim: true, maxlength: 500 },
    ogTitle: { type: String, trim: true, maxlength: 70 },
    ogDescription: { type: String, trim: true, maxlength: 200 },
    ogImage: { type: Schema.Types.ObjectId, ref: "Media" },
    ogType: {
      type: String,
      enum: ["website", "article", "product"],
      default: "website",
    },
    twitterCard: {
      type: String,
      enum: ["summary", "summary_large_image"],
      default: "summary_large_image",
    },
    keywords: [{ type: String, trim: true, maxlength: 60 }],
    schemaType: {
      type: String,
      enum: ["Organization", "Product", "WebPage", "BreadcrumbList", "FAQPage"],
    },
    noIndex: { type: Boolean, default: false },
    noFollow: { type: Boolean, default: false },
  },
  { _id: false }
);

export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
