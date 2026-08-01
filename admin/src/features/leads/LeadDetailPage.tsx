import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { ErrorState, LoadingState, PageHeader } from "@/components/common/states";
import { StatusBadge } from "./StatusBadge";
import {
  STATUS_LABEL,
  STATUS_TRANSITIONS,
  assignedName,
  leadsApi,
  type Lead,
} from "./leads.api";
import { absoluteTime, relativeTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";
import { can } from "@/lib/permissions";
import type { LeadStatus } from "@/types/api";

export function LeadDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [note, setNote] = useState("");
  const [lostFor, setLostFor] = useState<LeadStatus | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => leadsApi.get(id),
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => leadsApi.users(),
    // Only admins can read the user list; asking as `sales` would 403.
    enabled: can(user?.role, "leads.assign"),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["lead", id] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function onError(err: unknown) {
    setActionError(
      err instanceof ApiError ? err.message : "Something went wrong."
    );
  }

  const updateStatus = useMutation({
    mutationFn: (vars: { status: LeadStatus; lostReason?: string }) =>
      leadsApi.update(id, vars),
    onSuccess: () => {
      setActionError(null);
      setLostFor(null);
      setLostReason("");
      invalidate();
    },
    onError,
  });

  const addNote = useMutation({
    mutationFn: (text: string) => leadsApi.addNote(id, text),
    onSuccess: () => {
      setNote("");
      setActionError(null);
      invalidate();
    },
    onError,
  });

  const assign = useMutation({
    mutationFn: (userId: string | null) => leadsApi.assign(id, userId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError,
  });

  if (isPending) return <LoadingState label="Loading lead" />;

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

  const { lead, activities } = data;
  const allowed = STATUS_TRANSITIONS[lead.status];
  const isClosed = allowed.length === 0;

  function handleStatusChange(next: string) {
    if (!next) return;
    // A reason is mandatory server-side; ask for it rather than round-trip
    // to a 400 the user cannot act on.
    if (next === "lost") {
      setLostFor("lost");
      return;
    }
    updateStatus.mutate({ status: next as LeadStatus });
  }

  return (
    <>
      <PageHeader
        title={lead.name}
        description={`${lead.leadNumber} · received ${relativeTime(lead.createdAt)}`}
        actions={
          <Link to="/leads">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Section title="Contact">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Email" value={lead.email} href={`mailto:${lead.email}`} />
              <Detail label="Phone" value={lead.phone} href={`tel:${lead.phone}`} />
              <Detail label="Company" value={lead.company} />
              <Detail
                label="Location"
                value={[lead.city, lead.state].filter(Boolean).join(", ")}
              />
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:${lead.phone}`}>
                <Button variant="secondary" size="sm">
                  <Phone className="h-4 w-4" aria-hidden />
                  Call
                </Button>
              </a>
              <a href={`mailto:${lead.email}`}>
                <Button variant="secondary" size="sm">
                  <Mail className="h-4 w-4" aria-hidden />
                  Email
                </Button>
              </a>
              <a
                href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="sm">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  WhatsApp
                </Button>
              </a>
            </div>
          </Section>

          <Section title="Enquiry">
            {/* Plain text, rendered as text. Lead messages are
                attacker-controlled and never contain markup we honour. */}
            <p className="whitespace-pre-wrap text-sm text-slate-700">{lead.message}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Type" value={lead.type} />
              <Detail label="Product" value={lead.productName ?? "General enquiry"} />
              <Detail label="Quantity" value={lead.quantity} />
              <Detail label="Source" value={lead.source} />
            </dl>
          </Section>

          <Section title="Activity">
            {can(user?.role, "leads.write") && (
              <form
                className="mb-4 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) addNote.mutate(note.trim());
                }}
              >
                <Field label="Add a note" htmlFor="note">
                  <Textarea
                    id="note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={addNote.isPending}
                  disabled={!note.trim()}
                >
                  Add note
                </Button>
              </form>
            )}

            <ol className="space-y-3">
              {activities.map((activity) => (
                <li key={activity._id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-slate-800">
                      {activity.type === "status_changed" && activity.toStatus ? (
                        <>
                          Status changed to{" "}
                          <strong>{STATUS_LABEL[activity.toStatus]}</strong>
                        </>
                      ) : activity.type === "note" ? (
                        activity.note
                      ) : activity.type === "created" ? (
                        "Lead created"
                      ) : (
                        activity.note ?? activity.type
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {activity.userId?.name ?? "System"} ·{" "}
                      <span title={absoluteTime(activity.createdAt)}>
                        {relativeTime(activity.createdAt)}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <aside className="space-y-4">
          <Section title="Status">
            <div className="mb-3">
              <StatusBadge status={lead.status} />
            </div>

            {isClosed ? (
              <p className="text-sm text-slate-500">
                This lead is closed and its status cannot change.
                {lead.lostReason && (
                  <span className="mt-1 block text-slate-700">{lead.lostReason}</span>
                )}
              </p>
            ) : (
              <Field label="Move to" htmlFor="status-select">
                <Select
                  id="status-select"
                  value=""
                  disabled={
                    updateStatus.isPending || !can(user?.role, "leads.write")
                  }
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {allowed.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </Section>

          {can(user?.role, "leads.assign") && (
            <Section title="Assignment">
              <Field label="Assigned to" htmlFor="assignee">
                <Select
                  id="assignee"
                  value={
                    typeof lead.assignedTo === "object" && lead.assignedTo
                      ? lead.assignedTo._id
                      : ""
                  }
                  disabled={assign.isPending}
                  onChange={(e) => assign.mutate(e.target.value || null)}
                >
                  <option value="">Unassigned</option>
                  {/* Editors have no lead access, so offering them would
                      produce a 400 the user cannot act on. */}
                  {(users ?? [])
                    .filter((u) => u.isActive && u.role !== "editor")
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                </Select>
              </Field>
            </Section>
          )}

          <Section title="Details">
            <dl className="space-y-2">
              <Detail label="Priority" value={lead.priority} />
              <Detail label="Assigned" value={assignedName(lead) ?? "Unassigned"} />
              <Detail label="Received" value={absoluteTime(lead.createdAt)} />
              {lead.spamScore > 0 && (
                <Detail label="Spam score" value={String(lead.spamScore)} />
              )}
            </dl>
          </Section>
        </aside>
      </div>

      {actionError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 max-w-sm rounded-md bg-red-600 px-4 py-3 text-sm text-white shadow-lg"
        >
          {actionError}
        </div>
      )}

      <Dialog
        open={lostFor !== null}
        onClose={() => setLostFor(null)}
        title="Mark this lead as lost"
        description="A reason is required and is recorded on the timeline."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setLostFor(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={updateStatus.isPending}
              disabled={!lostReason.trim()}
              onClick={() =>
                updateStatus.mutate({ status: "lost", lostReason: lostReason.trim() })
              }
            >
              Mark lost
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="lost-reason" required>
          <Textarea
            id="lost-reason"
            rows={3}
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
          />
        </Field>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Detail({
  label,
  value,
  href,
}: {
  label: string;
  value?: string | undefined;
  href?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">
        {!value ? (
          <span className="text-slate-400">—</span>
        ) : href ? (
          <a className="text-brand-700 hover:underline" href={href}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export type { Lead };
