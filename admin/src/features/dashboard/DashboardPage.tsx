import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common/states";
import { useAuth } from "@/features/auth/AuthProvider";
import { can } from "@/lib/permissions";
import type { DashboardData, LeadStatus } from "@/types/api";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  quotation_sent: "Quotation sent",
  won: "Won",
  lost: "Lost",
};

const STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-[var(--color-status-new)]",
  contacted: "bg-[var(--color-status-contacted)]",
  qualified: "bg-[var(--color-status-qualified)]",
  quotation_sent: "bg-[var(--color-status-quotation)]",
  won: "bg-[var(--color-status-won)]",
  lost: "bg-[var(--color-status-lost)]",
};

export function DashboardPage() {
  const { user } = useAuth();
  const canSeeLeads = can(user?.role, "leads.read");

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/admin/dashboard"),
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          data
            ? `${new Date(data.range.from).toLocaleDateString()} – ${new Date(data.range.to).toLocaleDateString()}`
            : "Last 30 days"
        }
      />

      <div className="p-6">
        {isPending && <LoadingState label="Loading dashboard" />}

        {error && (
          <ErrorState
            message={error instanceof ApiError ? error.message : "Unexpected error."}
            onRetry={() => void refetch()}
          />
        )}

        {data && (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Total leads" value={data.totalLeads} />
              <Kpi
                label="New leads"
                value={data.newLeads}
                sub={data.newLeads > 0 ? "Needs attention" : "All triaged"}
                emphasis={data.newLeads > 0}
              />
              <Kpi
                label="Quote requests"
                value={data.quoteRequests}
                sub={
                  data.totalLeads > 0
                    ? `${Math.round((data.quoteRequests / data.totalLeads) * 100)}% of total`
                    : undefined
                }
              />
              <Kpi
                label="Product views"
                value={data.productViews}
                // Explicitly "not measured yet" rather than 0, which would
                // read as "nobody looked".
                sub={data.productViews === null ? "Not tracked until the catalogue is live" : undefined}
              />
            </section>

            {canSeeLeads && (
              <section className="grid gap-6 lg:grid-cols-2">
                <Panel title="Pipeline">
                  {Object.keys(data.leadsByStatus).length === 0 ? (
                    <EmptyState
                      title="No leads in this period"
                      description="Submissions from the website will appear here."
                    />
                  ) : (
                    <ul className="space-y-2">
                      {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((status) => {
                        const count = data.leadsByStatus[status] ?? 0;
                        return (
                          <li key={status} className="flex items-center gap-3 text-sm">
                            <span
                              className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[status])}
                              aria-hidden
                            />
                            <span className="flex-1 text-slate-700">
                              {STATUS_LABEL[status]}
                            </span>
                            <span className="tabular-nums font-medium text-slate-900">
                              {count}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>

                <Panel title="Recent leads">
                  {data.recentLeads.length === 0 ? (
                    <EmptyState
                      title="No leads yet"
                      description="Submissions from the website contact form will appear here."
                    />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {data.recentLeads.map((lead) => (
                        <li key={lead._id} className="flex items-center gap-3 py-2 text-sm">
                          <span
                            className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[lead.status])}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-slate-900">{lead.name}</p>
                            <p className="truncate text-xs text-slate-500">
                              {lead.company || lead.email}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">
                            {STATUS_LABEL[lead.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: number | null;
  sub?: string | undefined;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          emphasis ? "text-brand-700" : "text-slate-900"
        )}
      >
        {value === null ? <span className="text-lg text-slate-400">—</span> : value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-900">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </div>
  );
}
