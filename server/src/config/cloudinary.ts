import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env, isCloudinaryConfigured } from "./env";
import { AppError, ErrorCode } from "../utils/AppError";

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

export interface UploadResult {
  publicId: string;
  url: string;
  bytes: number;
  width?: number;
  height?: number;
}

function assertConfigured(): void {
  if (!isCloudinaryConfigured) {
    throw new AppError(
      503,
      "Media storage is not configured.",
      ErrorCode.UPLOAD_FAILED
    );
  }
}

/**
 * Streams the buffer straight to Cloudinary. Nothing touches this server's
 * disk — no temp directory to fill, no path traversal via filename, no
 * leftover files. docs/SECURITY_ARCHITECTURE.md §7
 */
export async function uploadBuffer(
  buffer: Buffer,
  options: { folder: string; publicId: string; isImage: boolean }
): Promise<UploadResult> {
  assertConfigured();

  return new Promise<UploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `dudhat-def/${options.folder}`,
        public_id: options.publicId,
        // `raw` for PDFs; `image` lets Cloudinary transform and optimise.
        resource_type: options.isImage ? "image" : "raw",
        overwrite: false,
        // The filename is ours, not the client's.
        use_filename: false,
        unique_filename: false,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(
            new AppError(
              502,
              "Upload to media storage failed.",
              ErrorCode.UPLOAD_FAILED
            )
          );
          return;
        }
        resolve({
          publicId: result.public_id,
          url: result.secure_url,
          bytes: result.bytes,
          ...(result.width ? { width: result.width } : {}),
          ...(result.height ? { height: result.height } : {}),
        });
      }
    );

    stream.end(buffer);
  });
}

export async function destroyAsset(
  publicId: string,
  isImage: boolean
): Promise<void> {
  assertConfigured();
  await cloudinary.uploader.destroy(publicId, {
    resource_type: isImage ? "image" : "raw",
  });
}

export { isCloudinaryConfigured };
