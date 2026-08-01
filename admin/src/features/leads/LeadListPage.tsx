import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, Search } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from "@/components/common/states";
import { StatusBadge } from "./StatusBadge";
import { LEAD_STATUSES, STATUS_LABEL, assignedName, leadsApi } from "./leads.api";
import { absoluteTime, hoursSince, relativeTime } from "@/lib/format";
import type { LeadStatus } from "@/types/api";
import { cn } from "@/lib/utils";

/** A lead sitting in `new` beyond this is visibly ageing. */
const AGEING_HOURS = 48;

export function LeadListPage() {
  // Filters live in the URL so a view can be bookmarked and shared.
  const [params, setParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(params.get("search") ?? "");

  const filters = {
    page: Number(params.get("page") ?? 1),
    limit: 20,
    status: (params.get("status") ?? "") as LeadStatus | "",
    priority: params.get("priority") ?? "",
    search: params.get("search") ?? "",
    isSpam: (params.get("isSpam") ?? "") as "true" | "false" | "",
  };

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["leads", filters],
    queryFn: () => leadsApi.list(filters),
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Any filter change invalidates the current page number.
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  const hasFilters =
    Boolean(filters.status || filters.priority || filters.search || filters.isSpam);

  return (
    <>
      <PageHeader
        title="Leads"
        description={data ? `${data.meta.total} total` : "Loading…"}
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-2">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setParam("search", searchDraft.trim());
            }}
          >
            <div className="w-64">
              <label htmlFor="lead-search" className="sr-only">
                Search leads
              </label>
              <Input
                id="lead-search"
                type="search"
                placeholder="Name, company, email…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="md">
              <Search className="h-4 w-4" aria-hidden />
              Search
            </Button>
          </form>

          <div className="w-44">
            <label htmlFor="filter-status" className="sr-only">
              Filter by status
            </label>
            <Select
              id="filter-status"
              value={filters.status}
              onChange={(e) => setParam("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-36">
            <label htmlFor="filter-priority" className="sr-only">
              Filter by priority
            </label>
            <Select
              id="filter-priority"
              value={filters.priority}
              onChange={(e) => setParam("priority", e.target.value)}
            >
              <option value="">Any priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>

          <div className="w-36">
            <label htmlFor="filter-spam" className="sr-only">
              Spam
            </label>
            {/* Spam is excluded by default server-side; this opts into it. */}
            <Select
              id="filter-spam"
              value={filters.isSpam}
              onChange={(e) => setParam("isSpam", e.target.value)}
            >
              <option value="">Hide spam</option>
              <option value="true">Spam only</option>
            </Select>
          </div>

          {hasFilters && (
            <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
              Clear
            </Button>
          )}

          <Link to="/leads/board" className="ml-auto">
            <Button variant="secondary">Board view</Button>
          </Link>
        </div>

        {isPending && (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        )}

        {error && (
          <ErrorState
            message={error instanceof ApiError ? error.message : "Unexpected error."}
            onRetry={() => void refetch()}
          />
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            title={hasFilters ? "No leads match those filters" : "No leads yet"}
            description={
              hasFilters
                ? "Try widening or clearing the filters."
                : "Submissions from the website contact form will appear here."
            }
          />
        )}

        {data && data.items.length > 0 && (
          <>
            <div
              className={cn(
                "overflow-x-auto rounded-lg border border-slate-200 bg-white",
                // Background refetch is indicated, not hidden — the alternative
                // is stale data that looks current.
                isFetching && "opacity-70"
              )}
            >
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Lead</th>
                    <th scope="col" className="px-3 py-2 font-medium">Contact</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium">Assigned</th>
                    <th scope="col" className="px-3 py-2 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((lead) => {
                    const ageing =
                      lead.status === "new" && hoursSince(lead.createdAt) > AGEING_HOURS;
                    return (
                      <tr key={lead._id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {/* Response time is the biggest lever on lead
                                conversion, so staleness is visible in the
                                list rather than buried in a report. */}
                            {ageing && (
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                                title={`Untouched for over ${AGEING_HOURS} hours`}
                              />
                            )}
                            <div className="min-w-0">
                              <Link
                                to={`/leads/${lead._id}`}
                                className="font-medium text-brand-700 hover:underline"
                              >
                                {lead.name}
                              </Link>
                              <p className="truncate text-xs text-slate-500">
                                {lead.company || lead.leadNumber}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-slate-700">{lead.email}</p>
                          <p className="text-xs text-slate-500">{lead.phone}</p>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={lead.status} />
                          {lead.isSpam && (
                            <span className="ml-1 text-xs text-slate-400">spam</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {assignedName(lead) ?? (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2 text-slate-500"
                          title={absoluteTime(lead.createdAt)}
                        >
                          {relativeTime(lead.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-600">
              <p>
                Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} leads
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!data.meta.hasPrev}
                  onClick={() => setParam("page", String(data.meta.page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!data.meta.hasNext}
                  onClick={() => setParam("page", String(data.meta.page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export { Copy };
