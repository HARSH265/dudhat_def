import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/common/states";
import { MEDIA_FOLDERS, formatBytes, mediaApi, type Media, type MediaFilters } from "./media.api";
import { absoluteTime, relativeTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Mirrors the server allowlist. Advisory only — magic bytes decide. */
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export function MediaLibraryPage({
  selectMode,
  onSelect,
}: {
  selectMode?: "image" | "document";
  onSelect?: (media: Media) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<MediaFilters>(
    selectMode ? { fileType: selectMode } : {}
  );
  const [folder, setFolder] = useState("general");
  const [detail, setDetail] = useState<Media | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isPending, error: queryError, refetch } = useQuery({
    queryKey: ["media", filters],
    queryFn: () => mediaApi.list(filters),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => mediaApi.upload(files, { folder }),
    onSuccess: (uploaded) => {
      setError(null);
      const reused = uploaded.filter((m) => m.wasDuplicate).length;
      setNotice(
        reused > 0
          ? `Uploaded ${uploaded.length - reused}, reused ${reused} identical file${reused === 1 ? "" : "s"}.`
          : `Uploaded ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}.`
      );
      void queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    },
  });

  const updateMeta = useMutation({
    mutationFn: (vars: { id: string; alt: string; caption: string }) =>
      mediaApi.update(vars.id, { alt: vars.alt, caption: vars.caption }),
    onSuccess: (media) => {
      setDetail(media);
      void queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : "Could not save."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => mediaApi.remove(id),
    onSuccess: () => {
      setDetail(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (err: unknown) =>
      // The server refuses while usageCount > 0 and names the count.
      setError(err instanceof ApiError ? err.message : "Could not delete."),
  });

  function setFilter(key: keyof MediaFilters, value: string) {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  }

  return (
    <>
      {!selectMode && (
        <PageHeader
          title="Media library"
          description={data ? `${data.meta.total} files` : "Loading…"}
        />
      )}

      <div className={cn("space-y-4", selectMode ? "p-0" : "p-6")}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <label htmlFor="media-folder" className="sr-only">Folder</label>
            <Select
              id="media-folder"
              value={filters.folder ?? ""}
              onChange={(e) => setFilter("folder", e.target.value)}
            >
              <option value="">All folders</option>
              {MEDIA_FOLDERS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>
          </div>

          <div className="w-44">
            <label htmlFor="media-flag" className="sr-only">Filter</label>
            <Select
              id="media-flag"
              value={filters.missingAlt ? "missingAlt" : filters.unusedOnly ? "unused" : ""}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((f) => ({
                  ...f,
                  missingAlt: v === "missingAlt" ? "true" : "",
                  unusedOnly: v === "unused" ? "true" : "",
                }));
              }}
            >
              <option value="">All files</option>
              <option value="missingAlt">Missing alt text</option>
              <option value="unused">Unused only</option>
            </Select>
          </div>

          {can(user?.role, "media.write") && (
            <div className="ml-auto flex items-end gap-2">
              <div className="w-36">
                <label htmlFor="upload-folder" className="sr-only">Upload to</label>
                <Select
                  id="upload-folder"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                >
                  {MEDIA_FOLDERS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </Select>
              </div>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) upload.mutate(files);
                  e.target.value = "";
                }}
              />
              <Button
                isLoading={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Upload
              </Button>
            </div>
          )}
        </div>

        {notice && (
          <p role="status" className="rounded-md bg-accent-50 px-3 py-2 text-sm text-accent-600">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {isPending && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}
          </div>
        )}

        {queryError && (
          <ErrorState
            message={queryError instanceof ApiError ? queryError.message : "Unexpected error."}
            onRetry={() => void refetch()}
          />
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            title="No files"
            description="Upload JPEG, PNG, WebP or PDF. Other formats are rejected by content, not by extension."
          />
        )}

        {data && data.items.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {data.items.map((media) => (
              <li key={media._id}>
                <button
                  type="button"
                  onClick={() => (selectMode ? onSelect?.(media) : setDetail(media))}
                  className="group w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition-colors duration-150 hover:border-brand-500"
                >
                  <div className="flex aspect-square items-center justify-center bg-slate-50">
                    {media.fileType === "image" ? (
                      <img
                        src={media.url}
                        alt={media.alt ?? ""}
                        loading="lazy"
                        width={media.width ?? 200}
                        height={media.height ?? 200}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <FileText className="h-8 w-8 text-slate-400" aria-hidden />
                    )}
                  </div>
                  <div className="border-t border-slate-100 p-2">
                    <p className="truncate text-xs font-medium text-slate-800">
                      {media.filename}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatBytes(media.size)}
                      {media.usageCount > 0 && ` · used ${media.usageCount}×`}
                    </p>
                    {!media.alt && media.fileType === "image" && (
                      <p className="text-xs text-amber-600">No alt text</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MediaDetailDialog
        media={detail}
        onClose={() => setDetail(null)}
        onSave={(alt, caption) =>
          detail && updateMeta.mutate({ id: detail._id, alt, caption })
        }
        onDelete={() => detail && remove.mutate(detail._id)}
        isSaving={updateMeta.isPending}
        isDeleting={remove.isPending}
        canDelete={can(user?.role, "media.delete")}
      />
    </>
  );
}

function MediaDetailDialog({
  media,
  onClose,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
  canDelete,
}: {
  media: Media | null;
  onClose: () => void;
  onSave: (alt: string, caption: string) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  canDelete: boolean;
}) {
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Sync form state when a different file is opened.
  if (media && loadedFor !== media._id) {
    setLoadedFor(media._id);
    setAlt(media.alt ?? "");
    setCaption(media.caption ?? "");
  }

  return (
    <Dialog
      open={media !== null}
      onClose={onClose}
      title={media?.filename ?? ""}
      className="max-w-lg"
      footer={
        <>
          {canDelete && (
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={onDelete}
              className="mr-auto"
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" isLoading={isSaving} onClick={() => onSave(alt, caption)}>
            Save
          </Button>
        </>
      }
    >
      {media && (
        <div className="space-y-4">
          {media.fileType === "image" && (
            <img
              src={media.url}
              alt={media.alt ?? ""}
              className="max-h-56 w-full rounded border border-slate-200 object-contain"
            />
          )}

          <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div><dt className="text-slate-400">Size</dt><dd>{formatBytes(media.size)}</dd></div>
            <div><dt className="text-slate-400">Type</dt><dd>{media.mimeType}</dd></div>
            {media.width && (
              <div><dt className="text-slate-400">Dimensions</dt><dd>{media.width}×{media.height}</dd></div>
            )}
            <div><dt className="text-slate-400">Used in</dt><dd>{media.usageCount} place(s)</dd></div>
            <div className="col-span-2">
              <dt className="text-slate-400">Uploaded</dt>
              <dd title={absoluteTime(media.createdAt)}>{relativeTime(media.createdAt)}</dd>
            </div>
          </dl>

          <Field
            label="Alt text"
            htmlFor="media-alt"
            hint="Required before this image can be attached to published content."
          >
            <Input value={alt} onChange={(e) => setAlt(e.target.value)} />
          </Field>

          <Field label="Caption" htmlFor="media-caption">
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>

          {media.usageCount > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-slate-500">
              <X className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              In use, so deletion is blocked. Remove it from the {media.usageCount} place
              {media.usageCount === 1 ? "" : "s"} that reference it first.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
