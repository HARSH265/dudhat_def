import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ApiError } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const next = (location.state as { next?: string } | null)?.next ?? "/";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      // The server returns an identical message for an unknown email and a
      // wrong password, and this surfaces it verbatim — narrowing it here
      // would undo the enumeration resistance.
      setError(
        err instanceof ApiError ? err.message : "Could not sign in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-brand-800 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-brand-700">Dudhat DEF</h1>
          <p className="text-sm text-slate-500">Admin panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" required>
            <Input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label="Password" htmlFor="password" required>
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {/* No "forgot password" link: the endpoint does not exist yet.
            docs/SECURITY_TODO.md S4 */}
      </div>
    </main>
  );
}
