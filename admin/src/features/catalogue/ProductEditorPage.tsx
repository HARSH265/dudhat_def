import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState, PageHeader } from "@/components/common/states";
import { RichTextEditor } from "./RichTextEditor";
import { SeoPanel } from "./SeoPanel";
import { MediaLibraryPage } from "@/features/media/MediaLibraryPage";
import { catalogueApi, type Product, type SpecItem } from "./catalogue.api";
import { useAuth } from "@/features/auth/AuthProvider";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Tab = "basic" | "specs" | "packaging" | "media" | "seo";

const TABS: { id: Tab; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "specs", label: "Specifications" },
  { id: "packaging", label: "Packaging" },
  { id: "media", label: "Media" },
  { id: "seo", label: "SEO" },
];

export function ProductEditorPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canPublish = can(user?.role, "catalogue.publish");

  const [tab, setTab] = useState<Tab>("basic");
  const [form, setForm] = useState<Partial<Product>>({ specifications: [], packaging: [] });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<{ field: string; message: string }[]>([]);
  const [picker, setPicker] = useState<null | "primaryImage">(null);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => catalogueApi.listCategories(),
  });

  const product = useQuery({
    queryKey: ["product", id],
    queryFn: () => catalogueApi.getProduct(id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (product.data) setForm(product.data);
  }, [product.data]);

  // Unsaved changes must not vanish on a stray navigation or tab close.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function patch(next: Partial<Product>) {
    setForm((f) => ({ ...f, ...next }));
    setDirty(true);
  }

  const onError = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? catalogueApi.createProduct(form)
        : catalogueApi.updateProduct(id!, form),
    onSuccess: (saved) => {
      setDirty(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["product", saved._id] });
      if (isNew) navigate(`/products/${saved._id}`, { replace: true });
    },
    onError,
  });

  const publish = useMutation({
    mutationFn: (status: "published" | "draft") =>
      catalogueApi.setProductStatus(id!, status),
    onSuccess: () => {
      setPublishErrors([]);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["product", id] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: unknown) => {
      // The gate returns EVERY blocker at once, so show them as a checklist
      // rather than one at a time.
      if (err instanceof ApiError && err.errors?.length) {
        setPublishErrors(err.errors);
        setError(null);
      } else onError(err);
    },
  });

  if (!isNew && product.isPending) return <LoadingState label="Loading product" />;
  if (!isNew && product.error) {
    return (
      <div className="p-6">
        <ErrorState
          message={product.error instanceof ApiError ? product.error.message : "Unexpected error."}
          onRetry={() => void product.refetch()}
        />
      </div>
    );
  }

  const isPublished = form.status === "published";

  return (
    <>
      <PageHeader
        title={isNew ? "New product" : (form.name ?? "Product")}
        description={form.slug ? `/${form.slug}` : "Slug is derived from the name"}
        actions={
          <>
            <Link to="/products">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            </Link>
            <Button size="sm" isLoading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
              {dirty ? "Save" : "Saved"}
            </Button>
            {!isNew && canPublish && (
              <Button
                variant={isPublished ? "secondary" : "primary"}
                size="sm"
                isLoading={publish.isPending}
                onClick={() => publish.mutate(isPublished ? "draft" : "published")}
              >
                {isPublished ? "Unpublish" : "Publish"}
              </Button>
            )}
          </>
        }
      />

      <div className="border-b border-slate-200 bg-white px-6">
        <nav className="flex gap-1" aria-label="Product sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "border-b-2 px-3 py-2 text-sm transition-colors duration-150",
                tab === t.id
                  ? "border-brand-700 font-medium text-brand-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-3xl space-y-4 p-6">
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {publishErrors.length > 0 && (
          <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">Not ready to publish</p>
            <ul className="mt-1 space-y-0.5 text-sm text-amber-800">
              {publishErrors.map((e, i) => (
                <li key={i}>• {e.message}</li>
              ))}
            </ul>
          </div>
        )}

        {tab === "basic" && (
          <>
            <Field label="Name" htmlFor="p-name" required>
              <Input value={form.name ?? ""} onChange={(e) => patch({ name: e.target.value })} />
            </Field>

            <Field
              label="Slug"
              htmlFor="p-slug"
              hint={isPublished ? "Locked: a published slug cannot change until redirect support ships." : undefined}
            >
              <Input value={form.slug ?? ""} disabled={isPublished || !isNew}
                onChange={(e) => patch({ slug: e.target.value })} />
            </Field>

            <Field label="Category" htmlFor="p-category" required>
              <Select value={form.categoryId ?? ""} onChange={(e) => patch({ categoryId: e.target.value })}>
                <option value="">Choose…</option>
                {(categories.data?.items ?? []).map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Short description" htmlFor="p-short"
              hint={`${(form.shortDescription ?? "").length}/300 — used on cards and as the meta description fallback.`}>
              <Textarea rows={2} maxLength={300} value={form.shortDescription ?? ""}
                onChange={(e) => patch({ shortDescription: e.target.value })} />
            </Field>

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Description</p>
              <RichTextEditor
                value={form.description ?? ""}
                onChange={(html) => patch({ description: html })}
              />
              <p className="mt-1 text-xs text-slate-500">
                Formatting is limited to the allowlist in RICH_TEXT_EDITOR_DECISION.md.
                Anything outside it is stripped when saved.
              </p>
            </div>
          </>
        )}

        {tab === "specs" && (
          <SpecificationsTab
            specs={form.specifications ?? []}
            onChange={(specifications) => patch({ specifications })}
          />
        )}

        {tab === "packaging" && (
          <p className="text-sm text-slate-500">
            Packaging variants are edited as structured rows. Volume, unit and container type
            are required; logistics fields are left empty rather than guessed.
            <span className="mt-2 block text-xs">
              Variant editing UI is not in this release — variants can be set via the API.
            </span>
          </p>
        )}

        {tab === "media" && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Primary image</p>
            {form.primaryImage ? (
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-500">{form.primaryImage}</span>
                <Button variant="ghost" size="sm" onClick={() => patch({ primaryImage: undefined })}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remove
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">None selected. Required to publish.</p>
            )}
            <Button variant="secondary" size="sm" onClick={() => setPicker("primaryImage")}>
              Choose from library
            </Button>
          </div>
        )}

        {tab === "seo" && (
          <SeoPanel
            seo={form.seo ?? {}}
            fallbackTitle={form.name ?? ""}
            fallbackDescription={form.shortDescription ?? ""}
            onChange={(seo) => patch({ seo })}
          />
        )}
      </div>

      <Dialog
        open={picker !== null}
        onClose={() => setPicker(null)}
        title="Choose an image"
        className="max-w-3xl"
        footer={<Button variant="secondary" size="sm" onClick={() => setPicker(null)}>Cancel</Button>}
      >
        <MediaLibraryPage
          selectMode="image"
          onSelect={(media) => {
            patch({ primaryImage: media._id });
            setPicker(null);
          }}
        />
      </Dialog>
    </>
  );
}

function SpecificationsTab({
  specs,
  onChange,
}: {
  specs: SpecItem[];
  onChange: (specs: SpecItem[]) => void;
}) {
  const placeholders = specs.filter((s) => s.isPlaceholder).length;

  function update(index: number, next: Partial<SpecItem>) {
    onChange(specs.map((s, i) => (i === index ? { ...s, ...next } : s)));
  }

  return (
    <div className="space-y-3">
      {placeholders > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {placeholders} row{placeholders === 1 ? " is" : "s are"} marked placeholder. These are
          published ISO limits, not measured results — publishing is blocked until real
          Certificate of Analysis values replace them.
        </p>
      )}

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="pb-1 font-medium">Label</th>
            <th scope="col" className="pb-1 font-medium">Value</th>
            <th scope="col" className="pb-1 font-medium">Unit</th>
            <th scope="col" className="pb-1 font-medium">Placeholder</th>
            <th scope="col" className="pb-1 sr-only">Remove</th>
          </tr>
        </thead>
        <tbody>
          {specs.map((spec, i) => (
            <tr key={i}>
              <td className="py-1 pr-2">
                <Input aria-label={`Specification ${i + 1} label`} value={spec.label}
                  onChange={(e) => update(i, { label: e.target.value })} />
              </td>
              <td className="py-1 pr-2">
                <Input aria-label={`Specification ${i + 1} value`} value={spec.value}
                  onChange={(e) => update(i, { value: e.target.value })} />
              </td>
              <td className="py-1 pr-2">
                <Input aria-label={`Specification ${i + 1} unit`} value={spec.unit ?? ""}
                  onChange={(e) => update(i, { unit: e.target.value })} />
              </td>
              <td className="py-1 pr-2 text-center">
                <input
                  type="checkbox"
                  aria-label={`Specification ${i + 1} is a placeholder`}
                  checked={spec.isPlaceholder ?? false}
                  onChange={(e) => update(i, { isPlaceholder: e.target.checked })}
                />
              </td>
              <td className="py-1">
                <Button variant="ghost" size="sm"
                  onClick={() => onChange(specs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button variant="secondary" size="sm"
        onClick={() => onChange([...specs, { label: "", value: "", isPlaceholder: false }])}>
        Add specification
      </Button>
    </div>
  );
}
