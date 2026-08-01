import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/select";
import { ErrorState, LoadingState, PageHeader } from "@/components/common/states";
import {
  LEAD_STATUSES,
  STATUS_LABEL,
  STATUS_TRANSITIONS,
  assignedName,
  leadsApi,
  type Lead,
} from "./leads.api";
import { relativeTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";
import { can } from "@/lib/permissions";
import type { LeadStatus } from "@/types/api";
import { cn } from "@/lib/utils";

/** Per column. An unbounded board is unusable and expensive to query. */
const COLUMN_CAP = 50;

const COLUMN_ACCENT: Record<LeadStatus, string> = {
  new: "border-t-[var(--color-status-new)]",
  contacted: "border-t-[var(--color-status-contacted)]",
  qualified: "border-t-[var(--color-status-qualified)]",
  quotation_sent: "border-t-[var(--color-status-quotation)]",
  won: "border-t-[var(--color-status-won)]",
  lost: "border-t-[var(--color-status-lost)]",
};

export function LeadBoardPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = can(user?.role, "leads.write");

  const [dragging, setDragging] = useState<Lead | null>(null);
  const [dropTarget, setDropTarget] = useState<LeadStatus | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["leads", "board"],
    queryFn: () => leadsApi.list({ limit: 100, sort: "-createdAt" }),
  });

  const move = useMutation({
    mutationFn: (vars: { id: string; status: LeadStatus; lostReason?: string }) =>
      leadsApi.update(vars.id, {
        status: vars.status,
        ...(vars.lostReason ? { lostReason: vars.lostReason } : {}),
      }),
    onSuccess: () => {
      setActionError(null);
      setLostLead(null);
      setLostReason("");
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: unknown) => {
      // The server's state machine is authoritative. A rejected move snaps
      // back because the query refetches — the card never lies about where
      // the lead actually is.
      setActionError(err instanceof ApiError ? err.message : "Could not move that lead.");
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  if (isPending) return <LoadingState label="Loading board" />;

  if (error) {
    return (
      <div className="p-6">
        <ErrorState
          message={error instanceof ApiError ? error.message : "Unexpected error."}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const byStatus = (status: LeadStatus) =>
    data.items.filter((l) => l.status === status);

  function handleDrop(status: LeadStatus) {
    const lead = dragging;
    setDragging(null);
    setDropTarget(null);
    if (!lead || lead.status === status) return;

    // Mirror of the server rule, checked here only to avoid a round-trip to
    // an error the user can see coming.
    if (!STATUS_TRANSITIONS[lead.status].includes(status)) {
      setActionError(
        STATUS_TRANSITIONS[lead.status].length === 0
          ? `${STATUS_LABEL[lead.status]} is a closed state and cannot change.`
          : `Cannot move from ${STATUS_LABEL[lead.status]} to ${STATUS_LABEL[status]}.`
      );
      return;
    }

    if (status === "lost") {
      setLostLead(lead);
      return;
    }

    move.mutate({ id: lead._id, status });
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={`${data.meta.total} leads`}
        actions={
          <Link to="/leads">
            <Button variant="secondary" size="sm">
              List view
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-3" style={{ minWidth: "60rem" }}>
          {LEAD_STATUSES.map((status) => {
            const leads = byStatus(status);
            const capped = leads.slice(0, COLUMN_CAP);
            const isTarget = dropTarget === status;
            const wouldReject =
              dragging !== null &&
              dragging.status !== status &&
              !STATUS_TRANSITIONS[dragging.status].includes(status);

            return (
              <section
                key={status}
                className={cn(
                  "flex w-56 shrink-0 flex-col rounded-lg border border-t-2 border-slate-200 bg-slate-50",
                  COLUMN_ACCENT[status],
                  isTarget && !wouldReject && "bg-brand-50 ring-2 ring-brand-500",
                  // Illegal targets are dimmed during a drag, so the rule is
                  // visible before the drop rather than after it.
                  isTarget && wouldReject && "opacity-50"
                )}
                onDragOver={(e) => {
                  if (!canWrite) return;
                  e.preventDefault();
                  setDropTarget(status);
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(status);
                }}
              >
                <header className="flex items-baseline justify-between px-3 py-2">
                  <h2 className="text-sm font-medium text-slate-800">
                    {STATUS_LABEL[status]}
                  </h2>
                  <span className="text-xs tabular-nums text-slate-500">
                    {leads.length}
                  </span>
                </header>

                <div className="flex-1 space-y-2 px-2 pb-2">
                  {capped.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-slate-400">
                      Empty
                    </p>
                  )}

                  {capped.map((lead) => (
                    <article
                      key={lead._id}
                      draggable={canWrite}
                      onDragStart={() => setDragging(lead)}
                      onDragEnd={() => {
                        setDragging(null);
                        setDropTarget(null);
                      }}
                      className={cn(
                        "rounded-md border border-slate-200 bg-white p-2.5 text-sm",
                        canWrite && "cursor-grab active:cursor-grabbing",
                        dragging?._id === lead._id && "opacity-40"
                      )}
                    >
                      <Link
                        to={`/leads/${lead._id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {lead.name}
                      </Link>
                      {lead.company && (
                        <p className="truncate text-xs text-slate-500">{lead.company}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {assignedName(lead) ?? "Unassigned"} ·{" "}
                        {relativeTime(lead.createdAt)}
                      </p>
                    </article>
                  ))}

                  {leads.length > COLUMN_CAP && (
                    // Silent truncation reads as "that's everything".
                    <p className="px-1 py-2 text-center text-xs text-slate-500">
                      +{leads.length - COLUMN_CAP} more — use the list view
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {!canWrite && (
          <p className="mt-4 text-xs text-slate-500">
            You have read-only access to leads.
          </p>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 max-w-sm rounded-md bg-red-600 px-4 py-3 text-sm text-white shadow-lg"
        >
          {actionError}
          <button
            className="ml-3 underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <Dialog
        open={lostLead !== null}
        onClose={() => setLostLead(null)}
        title={`Mark ${lostLead?.name ?? "this lead"} as lost`}
        description="A reason is required and is recorded on the timeline."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setLostLead(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={move.isPending}
              disabled={!lostReason.trim()}
              onClick={() =>
                lostLead &&
                move.mutate({
                  id: lostLead._id,
                  status: "lost",
                  lostReason: lostReason.trim(),
                })
              }
            >
              Mark lost
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="board-lost-reason" required>
          <Textarea
            id="board-lost-reason"
            rows={3}
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
          />
        </Field>
      </Dialog>
    </>
  );
}
