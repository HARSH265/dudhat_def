import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import type { SeoMeta } from "./catalogue.api";
import { cn } from "@/lib/utils";

/**
 * SEO editor. Shared by products and, later, pages — one component, one
 * contract. docs/ADMIN_PANEL_SPECIFICATION.md §5.11
 *
 * Empty fields are NOT persisted with computed values: the fallback chain
 * runs at read time, so renaming a product updates its meta title
 * automatically. The previews below show what the fallback would produce.
 * docs/SEO_ARCHITECTURE.md §3
 */
export function SeoPanel({
  seo,
  fallbackTitle,
  fallbackDescription,
  onChange,
}: {
  seo: SeoMeta;
  fallbackTitle: string;
  fallbackDescription: string;
  onChange: (seo: SeoMeta) => void;
}) {
  const set = (next: Partial<SeoMeta>) => onChange({ ...seo, ...next });

  const effectiveTitle = seo.metaTitle || (fallbackTitle ? `${fallbackTitle} | Dudhat DEF` : "");
  const effectiveDescription = seo.metaDescription || fallbackDescription;

  return (
    <div className="space-y-4">
      <Field
        label="Meta title"
        htmlFor="seo-title"
        hint="Blank uses the product name plus the brand suffix."
      >
        <Input value={seo.metaTitle ?? ""} onChange={(e) => set({ metaTitle: e.target.value })} />
      </Field>
      <Counter value={effectiveTitle.length} min={30} max={60} hardMax={70} unit="title" />

      <Field
        label="Meta description"
        htmlFor="seo-desc"
        hint="Blank uses the short description."
      >
        <Textarea rows={3} value={seo.metaDescription ?? ""}
          onChange={(e) => set({ metaDescription: e.target.value })} />
      </Field>
      <Counter value={effectiveDescription.length} min={120} max={160} hardMax={200} unit="description" />

      {/* A SERP preview is the only reliable way to see truncation before
          Google does it. */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Search result preview
        </p>
        <p className="truncate text-base text-[#1a0dab]">
          {effectiveTitle || "Untitled"}
        </p>
        <p className="text-xs text-[#006621]">www.dudhatdef.com/products/…</p>
        <p className="line-clamp-2 text-sm text-slate-600">
          {effectiveDescription || "No description. Search engines will invent one from the page."}
        </p>
      </div>

      <Field label="Canonical URL" htmlFor="seo-canonical"
        hint="Blank is self-canonical, which is correct for almost every page.">
        <Input value={seo.canonicalUrl ?? ""} onChange={(e) => set({ canonicalUrl: e.target.value })} />
      </Field>

      <Field label="Structured data type" htmlFor="seo-schema">
        <Select value={seo.schemaType ?? ""} onChange={(e) => set({ schemaType: e.target.value })}>
          <option value="">None</option>
          <option value="Product">Product</option>
          <option value="WebPage">WebPage</option>
        </Select>
      </Field>

      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Indexing</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={seo.noIndex ?? false}
            onChange={(e) => set({ noIndex: e.target.checked })} />
          Hide from search engines (noindex)
        </label>
        {seo.noIndex && (
          <p className="mt-1 text-xs text-amber-700">
            A published page with noindex will not appear in search results at all.
          </p>
        )}
      </fieldset>
    </div>
  );
}

/**
 * Length guidance rather than validation. These are search-engine display
 * limits, not correctness rules — a 65-character title is not an error, it is
 * a title that will be truncated.
 */
function Counter({
  value,
  min,
  max,
  hardMax,
  unit,
}: {
  value: number;
  min: number;
  max: number;
  hardMax: number;
  unit: string;
}) {
  const state =
    value === 0 ? "empty" : value < min ? "short" : value <= max ? "good" : "long";

  return (
    <p
      className={cn(
        "-mt-2 text-xs",
        state === "good" && "text-accent-600",
        state === "long" && "text-amber-700",
        (state === "short" || state === "empty") && "text-slate-500"
      )}
    >
      {value}/{max} characters
      {state === "long" && ` — over ${max}, this ${unit} will be truncated`}
      {state === "short" && ` — under ${min} is usually too thin`}
      {state === "empty" && ` — falling back (max ${hardMax})`}
    </p>
  );
}
