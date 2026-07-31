import { z } from "zod";
import { MEDIA_FOLDERS } from "../models/Media";

export const mediaListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(24),
    sort: z
      .enum(["-createdAt", "createdAt", "filename", "-size", "size"])
      .default("-createdAt"),
    folder: z.enum(MEDIA_FOLDERS).optional(),
    fileType: z.enum(["image", "document"]).optional(),
    tag: z.string().trim().max(50).optional(),
    search: z.string().trim().min(1).max(200).optional(),
    unusedOnly: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    missingAlt: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  })
  .strip();

export const uploadMetaSchema = z
  .object({
    folder: z.enum(MEDIA_FOLDERS).default("general"),
    alt: z.string().trim().max(300).optional(),
    caption: z.string().trim().max(500).optional(),
    // Arrives as a comma-separated string from multipart form data.
    tags: z
      .string()
      .max(500)
      .optional()
      .transform((v) =>
        v
          ? v
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 20)
          : []
      ),
  })
  .strip();

export const updateMediaSchema = z
  .object({
    alt: z.string().trim().max(300).optional(),
    caption: z.string().trim().max(500).optional(),
    folder: z.enum(MEDIA_FOLDERS).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  })
  .strip()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;
export type UploadMeta = z.infer<typeof uploadMetaSchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;
