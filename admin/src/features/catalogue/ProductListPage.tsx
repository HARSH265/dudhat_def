import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/common/states";
import { catalogueApi, STATUS_LABEL, type ContentStatus } from "./catalogue.api";
import { relativeTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ContentStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-accent-50 text-accent-600",
  archived: "bg-amber-50 text-amber-700",
};

export function ProductListPage() {
  const { user } = useAuth();
  const canWrite = can(user?.role, "catalogue.write");

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: () => catalogueApi.listProducts(),
  });

  const placeholderCount = (data?.items ?? []).filter((p) =>
    p.specifications?.some((s) => s.isPlaceholder)
  ).length;

  return (
    <>
      <PageHeader
        title="Products"
        description={data ? `${data.meta.total} total` : "Loading…"}
        actions={
          canWrite && (
            <Link to="/products/new">
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden />
                New product
              </Button>
            </Link>
          )
        }
      />

      <div className="space-y-4 p-6">
        {placeholderCount > 0 && (
          // Surfaced in the list, not just at the publish attempt — the
          // blocker is a business input with external turnaround.
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {placeholderCount} product{placeholderCount === 1 ? " has" : "s have"} placeholder
            specifications and cannot be published until real Certificate of Analysis values
            replace them.
          </p>
        )}

        {isPending && <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>}

        {error && (
          <ErrorState
            message={error instanceof ApiError ? error.message : "Unexpected error."}
            onRetry={() => void refetch()}
          />
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            title="No products yet"
            description="Create a category first, then add a product to it."
            action={canWrite ? <Link to="/products/new"><Button size="sm">New product</Button></Link> : undefined}
          />
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Product</th>
                  <th scope="col" className="px-3 py-2 font-medium">Category</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Enquiries</th>
                  <th scope="col" className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((product) => (
                  <tr key={product._id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link to={`/products/${product._id}`} className="font-medium text-brand-700 hover:underline">
                        {product.name}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">{product.slug}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{product.categoryName ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_STYLE[product.status])}>
                        {STATUS_LABEL[product.status]}
                      </span>
                      {product.specifications?.some((s) => s.isPlaceholder) && (
                        <span className="ml-1 text-xs text-amber-600">placeholder</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{product.inquiryCount}</td>
                    <td className="px-3 py-2 text-slate-500">{relativeTime(product.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
