import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { AppShell } from "@/components/common/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { LeadListPage } from "@/features/leads/LeadListPage";
import { LeadDetailPage } from "@/features/leads/LeadDetailPage";
import { LeadBoardPage } from "@/features/leads/LeadBoardPage";
import { MediaLibraryPage } from "@/features/media/MediaLibraryPage";
import { CategoryListPage } from "@/features/catalogue/CategoryListPage";
import { ProductListPage } from "@/features/catalogue/ProductListPage";
const ProductEditorPage = lazy(() =>
  import("@/features/catalogue/ProductEditorPage").then((m) => ({
    default: m.ProductEditorPage,
  }))
);
import { ProfilePage } from "@/features/profile/ProfilePage";
import { useAuth } from "@/features/auth/AuthProvider";
import { LoadingState } from "@/components/common/states";
import { can, type Capability } from "@/lib/permissions";

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

/**
 * Hides a screen the role cannot use. Still UX only — the endpoints behind it
 * enforce the same rule server-side.
 */
function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!can(user?.role, capability)) return <Navigate to="/" replace />;
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

        {/* `board` is declared before `:id` so it is not read as a lead id. */}
        <Route
          path="leads"
          element={
            <RequireCapability capability="leads.read">
              <LeadListPage />
            </RequireCapability>
          }
        />
        <Route
          path="leads/board"
          element={
            <RequireCapability capability="leads.read">
              <LeadBoardPage />
            </RequireCapability>
          }
        />
        <Route
          path="leads/:id"
          element={
            <RequireCapability capability="leads.read">
              <LeadDetailPage />
            </RequireCapability>
          }
        />

        <Route
          path="media"
          element={
            <RequireCapability capability="media.read">
              <MediaLibraryPage />
            </RequireCapability>
          }
        />

        <Route
          path="categories"
          element={
            <RequireCapability capability="catalogue.read">
              <CategoryListPage />
            </RequireCapability>
          }
        />

        {/* "new" before ":id" so it is not read as an identifier. */}
        <Route
          path="products"
          element={
            <RequireCapability capability="catalogue.read">
              <ProductListPage />
            </RequireCapability>
          }
        />
        <Route
          path="products/new"
          element={
            <RequireCapability capability="catalogue.write">
              <Suspense fallback={<LoadingState label="Loading editor" />}>
                <ProductEditorPage />
              </Suspense>
            </RequireCapability>
          }
        />
        <Route
          path="products/:id"
          element={
            <RequireCapability capability="catalogue.read">
              <Suspense fallback={<LoadingState label="Loading editor" />}>
                <ProductEditorPage />
              </Suspense>
            </RequireCapability>
          }
        />

        {/* Every authenticated user has a profile — no capability gate. */}
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Unknown paths go to the dashboard rather than a 404 — every route in
          an admin panel is one we own, so an unknown one is a stale bookmark. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
