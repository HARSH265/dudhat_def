import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "@/components/common/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { useAuth } from "@/features/auth/AuthProvider";
import { LoadingState } from "@/components/common/states";

/**
 * Route guards hide screens a role cannot use. They are UX, not security —
 * every endpoint is authorised server-side regardless.
 * docs/ADMIN_UI_ARCHITECTURE.md §4, docs/SECURITY_TODO.md S12
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  // Without this, a hard refresh flashes the login screen before the silent
  // refresh settles and then redirects back — which reads as a broken app.
  if (isBootstrapping) {
    return <LoadingState label="Restoring session" />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ next: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, isBootstrapping } = useAuth();
  if (isBootstrapping) return <LoadingState label="Restoring session" />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
      </Route>

      {/* Unknown paths go to the dashboard rather than a 404 — every route in
          an admin panel is one we own, so an unknown one is a stale bookmark. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
