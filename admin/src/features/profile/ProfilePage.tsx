import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, ShieldCheck } from "lucide-react";
import { api, ApiError, setAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ErrorState, PageHeader } from "@/components/common/states";
import { useAuth } from "@/features/auth/AuthProvider";
import { absoluteTime, relativeTime } from "@/lib/format";
import type { CurrentUser } from "@/types/api";

interface Session {
  id: string;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api.get<Session[]>("/admin/auth/sessions"),
  });

  const changePassword = useMutation({
    mutationFn: (vars: { currentPassword: string; newPassword: string }) =>
      api.patch<{ accessToken: string; user: CurrentUser }>(
        "/admin/auth/change-password",
        vars
      ),
    onSuccess: (result) => {
      // The server rotates rather than ends this session, so the returned
      // token replaces the in-memory one and the user stays signed in.
      setAccessToken(result.accessToken);
      setCurrent("");
      setNext("");
      setConfirm("");
      setFieldErrors({});
      setFormError(null);
      setDone(true);
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (err: unknown) => {
      setDone(false);
      if (err instanceof ApiError) {
        // The server returns { field, message } pairs precisely so they can
        // be mapped back onto the inputs that produced them.
        setFieldErrors(err.fieldErrors());
        setFormError(err.errors?.length ? null : err.message);
      } else {
        setFormError("Could not change your password.");
      }
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/auth/sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setDone(false);

    // Confirmation is checked here only — the server has no reason to know
    // the field exists.
    if (next !== confirm) {
      setFieldErrors({ confirm: "The two passwords do not match." });
      return;
    }
    changePassword.mutate({ currentPassword: current, newPassword: next });
  }

  return (
    <>
      <PageHeader title="Profile" description={user?.email} />

      <div className="grid max-w-4xl gap-6 p-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white">
          <h2 className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900">
            <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden />
            Change password
          </h2>

          <form onSubmit={submit} className="space-y-4 p-4" noValidate>
            <Field
              label="Current password"
              htmlFor="current-password"
              error={fieldErrors["currentPassword"]}
              required
            >
              <Input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>

            <Field
              label="New password"
              htmlFor="new-password"
              error={fieldErrors["newPassword"]}
              hint="At least 12 characters. Avoid common words, your name and your email."
              required
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </Field>

            <Field
              label="Confirm new password"
              htmlFor="confirm-password"
              error={fieldErrors["confirm"]}
              required
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>

            {formError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}

            {done && (
              <p role="status" className="rounded-md bg-accent-50 px-3 py-2 text-sm text-accent-600">
                Password changed. Other sessions have been signed out; this one stays active.
              </p>
            )}

            <Button
              type="submit"
              isLoading={changePassword.isPending}
              disabled={!current || !next || !confirm}
            >
              Change password
            </Button>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <h2 className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900">
            <Monitor className="h-4 w-4 text-slate-400" aria-hidden />
            Active sessions
          </h2>

          <div className="p-4">
            {sessions.error && (
              <ErrorState
                message={
                  sessions.error instanceof ApiError
                    ? sessions.error.message
                    : "Could not load sessions."
                }
                onRetry={() => void sessions.refetch()}
              />
            )}

            {sessions.data && (
              <ul className="divide-y divide-slate-100">
                {sessions.data.map((session) => (
                  <li key={session.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800">
                        {session.userAgent ?? "Unknown device"}
                        {session.isCurrent && (
                          <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">
                            This device
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500" title={absoluteTime(session.createdAt)}>
                        Signed in {relativeTime(session.createdAt)}
                      </p>
                    </div>
                    {/* Revoking the current session is refused server-side —
                        it would leave this client holding a dead cookie it
                        believes is live. Sign out does that properly. */}
                    {!session.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={revoke.isPending}
                        onClick={() => revoke.mutate(session.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-xs text-slate-500">
              Locations are not shown: IP addresses are stored hashed and cannot be
              reversed for display.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
