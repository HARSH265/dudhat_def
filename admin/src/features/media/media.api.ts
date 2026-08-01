import { api, qs } from "@/lib/api";

export const MEDIA_FOLDERS = [
  "products",
  "packaging",
  "general",
  "logo",
  "documents",
] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export interface Media {
  _id: string;
  filename: string;
  url: string;
  mimeType: string;
  fileType: "image" | "document";
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
  tags: string[];
  folder: MediaFolder;
  /** Non-zero blocks deletion server-side. */
  usageCount: number;
  createdAt: string;
  wasDuplicate?: boolean;
}

export interface MediaFilters {
  page?: number;
  folder?: string;
  fileType?: string;
  search?: string;
  unusedOnly?: "true" | "";
  missingAlt?: "true" | "";
}

export const mediaApi = {
  list: (filters: MediaFilters = {}) =>
    api.getPaged<Media>(`/admin/media${qs({ limit: 24, ...filters })}`),

  get: (id: string) => api.get<Media>(`/admin/media/${id}`),

  upload: (files: File[], meta: { folder: string; alt?: string; tags?: string }) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    form.append("folder", meta.folder);
    if (meta.alt) form.append("alt", meta.alt);
    if (meta.tags) form.append("tags", meta.tags);
    return api.post<Media[]>("/admin/media/upload", form);
  },

  update: (id: string, body: Partial<Pick<Media, "alt" | "caption" | "tags" | "folder">>) =>
    api.put<Media>(`/admin/media/${id}`, body),

  remove: (id: string) => api.delete(`/admin/media/${id}`),
};

/** Human file size. Byte counts in a UI are noise. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
