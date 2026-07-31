import type { FilterQuery, Types } from "mongoose";
import Media, { type IMedia, type MediaFolder } from "../models/Media";
import type { MediaListQuery } from "../validators/media.validator";
import type { Paged } from "./lead.repository";

export const mediaRepository = {
  async create(data: Partial<IMedia>): Promise<IMedia> {
    return Media.create(data);
  },

  async findById(id: string): Promise<IMedia | null> {
    return Media.findOne({ _id: id, isDeleted: false });
  },

  async findByChecksum(checksum: string): Promise<IMedia | null> {
    return Media.findOne({ checksum, isDeleted: false });
  },

  async list(q: MediaListQuery): Promise<Paged<IMedia>> {
    const filter: FilterQuery<IMedia> = { isDeleted: false };

    if (q.folder) filter.folder = q.folder;
    if (q.fileType) filter.fileType = q.fileType;
    if (q.tag) filter.tags = q.tag;
    if (q.search) filter.$text = { $search: q.search };
    // "unused" is the practical way to find assets safe to delete.
    if (q.unusedOnly) filter.usageCount = 0;
    if (q.missingAlt) filter.$or = [{ alt: { $exists: false } }, { alt: "" }];

    const [items, total] = await Promise.all([
      Media.find(filter)
        .sort(q.sort)
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<IMedia[]>(),
      Media.countDocuments(filter),
    ]);

    return { items, total };
  },

  async updateMeta(
    id: string,
    patch: {
      alt?: string;
      caption?: string;
      tags?: string[];
      folder?: MediaFolder;
      updatedBy: Types.ObjectId;
    }
  ): Promise<IMedia | null> {
    return Media.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: patch },
      { new: true, runValidators: true }
    );
  },

  /** Replace keeps the same _id so every embedded reference stays valid. */
  async replaceAsset(
    id: string,
    data: {
      publicId: string;
      url: string;
      mimeType: string;
      size: number;
      width?: number;
      height?: number;
      checksum: string;
      filename: string;
      updatedBy: Types.ObjectId;
    }
  ): Promise<IMedia | null> {
    return Media.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true }
    );
  },

  async softDelete(id: string, deletedBy: Types.ObjectId): Promise<IMedia | null> {
    return Media.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
      { new: true }
    );
  },

  async incrementUsage(id: Types.ObjectId, by: number): Promise<void> {
    // $inc only — never read-modify-write, which races.
    await Media.updateOne({ _id: id }, { $inc: { usageCount: by } });
  },
};
