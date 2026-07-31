import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Types } from "mongoose";
import { logger } from "../config/logger";
import { destroyAsset, uploadBuffer } from "../config/cloudinary";
import { mediaRepository } from "../repositories/media.repository";
import { auditService } from "./audit.service";
import { AppError, ErrorCode } from "../utils/AppError";
import { sha256 } from "../utils/crypto";
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  detectFileType,
  isImage,
  readImageDimensions,
} from "../utils/fileType";
import { MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from "../middleware/upload";
import type { IMedia } from "../models/Media";
import type { Paged } from "../repositories/lead.repository";
import type {
  MediaListQuery,
  UpdateMediaInput,
  UploadMeta,
} from "../validators/media.validator";

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export interface UploadOutcome {
  media: IMedia;
  wasDuplicate: boolean;
}

export const mediaService = {
  async list(q: MediaListQuery): Promise<Paged<IMedia>> {
    return mediaRepository.list(q);
  },

  async get(id: string): Promise<IMedia> {
    const media = await mediaRepository.findById(id);
    if (!media) throw AppError.notFound("Media not found.");
    return media;
  },

  async upload(
    file: UploadedFile,
    meta: UploadMeta,
    userId: Types.ObjectId
  ): Promise<UploadOutcome> {
    // Type comes from the bytes, never the extension or the client's
    // Content-Type. docs/SECURITY_ARCHITECTURE.md §7
    const detected = detectFileType(file.buffer);
    if (!detected) {
      throw new AppError(
        415,
        "Unsupported file type. Allowed: JPEG, PNG, WebP, PDF.",
        ErrorCode.UNSUPPORTED_FILE_TYPE
      );
    }

    const image = isImage(detected);
    const cap = image ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
    if (file.size > cap) {
      throw new AppError(
        413,
        `${image ? "Images" : "Documents"} must be under ${cap / (1024 * 1024)}MB.`,
        ErrorCode.FILE_TOO_LARGE
      );
    }

    // Same bytes means the same asset. Returning the existing record avoids
    // a second copy in storage and a second row to keep in sync.
    const checksum = sha256(file.buffer.toString("base64"));
    const existing = await mediaRepository.findByChecksum(checksum);
    if (existing) {
      return { media: existing, wasDuplicate: true };
    }

    const dimensions = image ? readImageDimensions(file.buffer, detected) : null;

    // The stored name is ours. The client's name survives only as a display
    // label — it never reaches a path or a URL.
    const publicId = `${sanitiseStem(file.originalname)}-${randomUUID().slice(0, 8)}`;

    const uploaded = await uploadBuffer(file.buffer, {
      folder: meta.folder,
      publicId,
      isImage: image,
    });

    const media = await mediaRepository.create({
      filename: path.basename(file.originalname).slice(0, 255),
      provider: "cloudinary",
      publicId: uploaded.publicId,
      url: uploaded.url,
      mimeType: detected,
      fileType: image ? "image" : "document",
      size: uploaded.bytes || file.size,
      ...(dimensions?.width ? { width: dimensions.width } : {}),
      ...(dimensions?.height ? { height: dimensions.height } : {}),
      ...(meta.alt ? { alt: meta.alt } : {}),
      ...(meta.caption ? { caption: meta.caption } : {}),
      tags: meta.tags,
      folder: meta.folder,
      checksum,
      usageCount: 0,
      createdBy: userId,
    });

    await auditService.record({
      userId,
      action: "create",
      entityType: "media",
      entityId: media._id,
      changes: { filename: media.filename, size: media.size },
    });

    logger.info({ mediaId: media.id, folder: meta.folder }, "Media uploaded");
    return { media, wasDuplicate: false };
  },

  async updateMeta(
    id: string,
    patch: UpdateMediaInput,
    userId: Types.ObjectId
  ): Promise<IMedia> {
    const updated = await mediaRepository.updateMeta(id, {
      ...patch,
      updatedBy: userId,
    });
    if (!updated) throw AppError.notFound("Media not found.");
    return updated;
  },

  /**
   * Keeps the same _id, so every document already referencing this asset
   * picks up the new file with no rewrite.
   * docs/ADMIN_PANEL_SPECIFICATION.md §5.10
   */
  async replace(
    id: string,
    file: UploadedFile,
    userId: Types.ObjectId
  ): Promise<IMedia> {
    const current = await mediaRepository.findById(id);
    if (!current) throw AppError.notFound("Media not found.");

    const detected = detectFileType(file.buffer);
    if (!detected) {
      throw new AppError(
        415,
        "Unsupported file type. Allowed: JPEG, PNG, WebP, PDF.",
        ErrorCode.UNSUPPORTED_FILE_TYPE
      );
    }

    const image = isImage(detected);
    // A PDF cannot silently become an image behind existing references.
    if ((current.fileType === "image") !== image) {
      throw AppError.badRequest(
        `This asset is ${current.fileType === "image" ? "an image" : "a document"}. ` +
          `Replace it with the same kind of file.`
      );
    }

    const cap = image ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
    if (file.size > cap) {
      throw new AppError(
        413,
        `${image ? "Images" : "Documents"} must be under ${cap / (1024 * 1024)}MB.`,
        ErrorCode.FILE_TOO_LARGE
      );
    }

    const dimensions = image ? readImageDimensions(file.buffer, detected) : null;
    const publicId = `${sanitiseStem(file.originalname)}-${randomUUID().slice(0, 8)}`;

    const uploaded = await uploadBuffer(file.buffer, {
      folder: current.folder,
      publicId,
      isImage: image,
    });

    const updated = await mediaRepository.replaceAsset(id, {
      publicId: uploaded.publicId,
      url: uploaded.url,
      mimeType: detected,
      size: uploaded.bytes || file.size,
      ...(dimensions?.width ? { width: dimensions.width } : {}),
      ...(dimensions?.height ? { height: dimensions.height } : {}),
      checksum: sha256(file.buffer.toString("base64")),
      filename: path.basename(file.originalname).slice(0, 255),
      updatedBy: userId,
    });
    if (!updated) throw AppError.notFound("Media not found.");

    // Remove the superseded binary only after the record points at the new
    // one. The other order risks a live reference to a deleted asset.
    void destroyAsset(current.publicId, current.fileType === "image").catch(
      (error: unknown) => {
        logger.warn(
          { err: error, publicId: current.publicId },
          "Old asset left in storage after replace"
        );
      }
    );

    await auditService.record({
      userId,
      action: "update",
      entityType: "media",
      entityId: updated._id,
      changes: { replaced: true, filename: updated.filename },
    });

    return updated;
  },

  async remove(id: string, userId: Types.ObjectId): Promise<void> {
    const media = await mediaRepository.findById(id);
    if (!media) throw AppError.notFound("Media not found.");

    // Deleting an asset that published content points at would leave broken
    // images on the live site. docs/API_SPECIFICATION.md §5.7
    if (media.usageCount > 0) {
      throw AppError.conflict(
        `This file is used in ${media.usageCount} place${media.usageCount === 1 ? "" : "s"} and cannot be deleted.`,
        ErrorCode.RESOURCE_IN_USE
      );
    }

    await mediaRepository.softDelete(id, userId);

    await auditService.record({
      userId,
      action: "delete",
      entityType: "media",
      entityId: media._id,
      changes: { filename: media.filename },
    });
  },
};

/**
 * Strips the client's filename down to a safe stem for use in a storage key.
 * Directory separators, traversal sequences and anything non-alphanumeric are
 * removed rather than escaped.
 */
function sanitiseStem(originalname: string): string {
  const base = path.basename(originalname);
  const stem = base.replace(/\.[^.]+$/, "");
  const safe = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return safe || "file";
}

export { ALLOWED_DOCUMENT_TYPES, ALLOWED_IMAGE_TYPES };
