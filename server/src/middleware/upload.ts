import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { AppError, ErrorCode } from "../utils/AppError";

/** docs/API_SPECIFICATION.md §5.7 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_FILES_PER_REQUEST = 10;

/**
 * Memory storage, not disk. The buffer is streamed to Cloudinary and
 * discarded — nothing is written to this server's filesystem.
 * docs/SECURITY_ARCHITECTURE.md §7
 *
 * The limit here is the permissive one (documents); images are checked
 * against the tighter cap once the real type is known from magic bytes,
 * because the client-supplied MIME cannot be trusted to pick a limit.
 */
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_DOCUMENT_BYTES,
    files: MAX_FILES_PER_REQUEST,
    // Non-file fields are metadata only; keep them small.
    fields: 20,
    fieldSize: 10 * 1024,
  },
}).array("files", MAX_FILES_PER_REQUEST);

/**
 * Multer reports its own errors outside the normal throw path, so they need
 * translating into the standard envelope rather than surfacing as a 500.
 */
export function handleUpload(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  uploadMiddleware(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(
          new AppError(
            413,
            `File exceeds the ${MAX_DOCUMENT_BYTES / (1024 * 1024)}MB limit.`,
            ErrorCode.FILE_TOO_LARGE
          )
        );
        return;
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        next(
          AppError.badRequest(
            `Up to ${MAX_FILES_PER_REQUEST} files per upload.`
          )
        );
        return;
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        next(AppError.badRequest('Unexpected field. Use "files".'));
        return;
      }
      next(AppError.badRequest(err.message));
      return;
    }

    next(err);
  });
}
