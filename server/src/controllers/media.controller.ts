import mongoose from "mongoose";
import type { Request, Response } from "express";
import { mediaService, type UploadedFile } from "../services/media.service";
import { query } from "../middleware/validate";
import { uploadMetaSchema, type MediaListQuery } from "../validators/media.validator";
import { AppError } from "../utils/AppError";
import type { UpdateMediaInput } from "../validators/media.validator";

function userId(req: Request) {
  return new mongoose.Types.ObjectId(req.user!.id);
}

function files(req: Request): UploadedFile[] {
  const list = req.files;
  if (!Array.isArray(list) || list.length === 0) {
    throw AppError.badRequest("No files were uploaded.");
  }
  return list as unknown as UploadedFile[];
}

export async function listMedia(_req: Request, res: Response): Promise<void> {
  const q = query<MediaListQuery>(res);
  const { items, total } = await mediaService.list(q);
  const totalPages = Math.max(1, Math.ceil(total / q.limit));

  res.status(200).json({
    success: true,
    message: "Media fetched.",
    data: items,
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasNext: q.page < totalPages,
      hasPrev: q.page > 1,
    },
  });
}

export async function getMedia(req: Request, res: Response): Promise<void> {
  const media = await mediaService.get(req.params["id"]!);
  res.status(200).json({ success: true, message: "Media fetched.", data: media });
}

export async function uploadMedia(req: Request, res: Response): Promise<void> {
  // Multipart text fields arrive as strings; parse them with the same
  // validator discipline as a JSON body.
  const parsed = uploadMetaSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw AppError.badRequest(
      parsed.error.issues[0]?.message ?? "Invalid upload metadata."
    );
  }

  const results = [];
  for (const file of files(req)) {
    // Sequential rather than parallel: a 10-file batch of 5MB images would
    // otherwise hold 50MB in memory and open 10 upload streams at once.
    results.push(await mediaService.upload(file, parsed.data, userId(req)));
  }

  const duplicates = results.filter((r) => r.wasDuplicate).length;
  res.status(201).json({
    success: true,
    message:
      duplicates > 0
        ? `Uploaded ${results.length - duplicates}, reused ${duplicates} existing file${duplicates === 1 ? "" : "s"}.`
        : `Uploaded ${results.length} file${results.length === 1 ? "" : "s"}.`,
    data: results.map((r) => ({ ...r.media.toObject?.() ?? r.media, wasDuplicate: r.wasDuplicate })),
  });
}

export async function updateMedia(req: Request, res: Response): Promise<void> {
  const media = await mediaService.updateMeta(
    req.params["id"]!,
    req.body as UpdateMediaInput,
    userId(req)
  );
  res.status(200).json({ success: true, message: "Media updated.", data: media });
}

export async function replaceMedia(req: Request, res: Response): Promise<void> {
  const [file] = files(req);
  const media = await mediaService.replace(req.params["id"]!, file!, userId(req));
  res.status(200).json({
    success: true,
    message: "File replaced. Every reference now points at the new version.",
    data: media,
  });
}

export async function deleteMedia(req: Request, res: Response): Promise<void> {
  await mediaService.remove(req.params["id"]!, userId(req));
  res.status(200).json({ success: true, message: "Media deleted.", data: {} });
}
