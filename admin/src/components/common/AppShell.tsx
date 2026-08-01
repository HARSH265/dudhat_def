import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  FolderTree,
  Image,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { can, type Capability } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  capability?: Capability;
  /** Screens that arrive in a later unit are shown disabled, not hidden —
   *  hiding them makes the panel look smaller than it is. */
  comingSoon?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: BarChart3, capability: "leads.read" },
  { to: "/products", label: "Products", icon: Package, capability: "catalogue.read", comingSoon: true },
  { to: "/categories", label: "Categories", icon: FolderTree, capability: "catalogue.read", comingSoon: true },
  { to: "/media", label: "Media", icon: Image, capability: "media.read", comingSoon: true },
  { to: "/settings", label: "Settings", icon: Settings, capability: "settings.read", comingSoon: true },
  { to: "/users", label: "Users", icon: Users, capability: "users.read", comingSoon: true },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visible = NAV.filter(
    (item) => !item.capability || can(user?.role, item.capability)
  );

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-semibold text-brand-700">Dudhat DEF</p>
          <p className="text-xs text-slate-500">Admin</p>
        </div>

        <nav className="flex-1 space-y-0.5 p-2" aria-label="Main">
          {visible.map(({ to, label, icon: Icon, comingSoon }) =>
            comingSoon ? (
              <span
                key={to}
                aria-disabled
                title="Available in a later release"
                className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-400"
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </span>
            ) : (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
                    isActive
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-slate-700 hover:bg-slate-100"
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </NavLink>
            )
          )}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <p className="mt-0.5 text-xs capitalize text-slate-400">{user?.role}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="mt-2 w-full justify-start px-2"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
