import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/common/states";
import { catalogueApi, STATUS_LABEL, type Category, type ContentStatus } from "./catalogue.api";
import { useAuth } from "@/features/auth/AuthProvider";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ContentStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-accent-50 text-accent-600",
  archived: "bg-amber-50 text-amber-700",
};

export function CategoryListPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = can(user?.role, "catalogue.write");
  const canPublish = can(user?.role, "catalogue.publish");

  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, error: queryError, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: () => catalogueApi.listCategories(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"] });
  const onError = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : "Something went wrong.");

  const save = useMutation({
    mutationFn: () =>
      editing === "new"
        ? catalogueApi.createCategory({
            name: form.name,
            ...(form.slug ? { slug: form.slug } : {}),
            description: form.description,
          })
        : catalogueApi.updateCategory((editing as Category)._id, {
            name: form.name,
            description: form.description,
          }),
    onSuccess: () => {
      setEditing(null);
      setError(null);
      void invalidate();
    },
    onError,
  });

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: ContentStatus }) =>
      catalogueApi.setCategoryStatus(vars.id, vars.status),
    onSuccess: () => { setError(null); void invalidate(); },
    // Archiving is refused while published products reference it, and the
    // server names them.
    onError,
  });

  function open(category: Category | "new") {
    setEditing(category);
    setError(null);
    setForm(
      category === "new"
        ? { name: "", slug: "", description: "" }
        : { name: category.name, slug: category.slug, description: category.description ?? "" }
    );
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description={data ? `${data.meta.total} total` : "Loading…"}
        actions={
          canWrite && (
            <Button size="sm" onClick={() => open("new")}>
              <Plus className="h-4 w-4" aria-hidden />
              New category
            </Button>
          )
        }
      />

      <div className="space-y-4 p-6">
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {isPending && <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>}

        {queryError && (
          <ErrorState
            message={queryError instanceof ApiError ? queryError.message : "Unexpected error."}
            onRetry={() => void refetch()}
          />
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            title="No categories yet"
            description="Products need a category before they can be created."
            action={canWrite ? <Button size="sm" onClick={() => open("new")}>New category</Button> : undefined}
          />
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium">Slug</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((category) => (
                  <tr key={category._id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {category.name}
                      {category.parentId && (
                        <span className="ml-2 text-xs text-slate-400">child</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{category.slug}</td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_STYLE[category.status])}>
                        {STATUS_LABEL[category.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <Button variant="ghost" size="sm" onClick={() => open(category)}>Edit</Button>
                        )}
                        {canPublish && category.status !== "published" && (
                          <Button variant="ghost" size="sm"
                            onClick={() => setStatus.mutate({ id: category._id, status: "published" })}>
                            Publish
                          </Button>
                        )}
                        {canPublish && category.status === "published" && (
                          <Button variant="ghost" size="sm"
                            onClick={() => setStatus.mutate({ id: category._id, status: "draft" })}>
                            Unpublish
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New category" : "Edit category"}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" isLoading={save.isPending} disabled={!form.name.trim()}
              onClick={() => save.mutate()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="cat-name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>

          <Field
            label="Slug"
            htmlFor="cat-slug"
            hint={
              editing !== "new" && (editing as Category)?.status === "published"
                ? "Locked: a published slug cannot change until redirect support ships."
                : "Left blank, it is derived from the name."
            }
          >
            <Input
              value={form.slug}
              disabled={editing !== "new"}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </Field>

          <Field label="Description" htmlFor="cat-desc">
            <Textarea rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export { Select };
