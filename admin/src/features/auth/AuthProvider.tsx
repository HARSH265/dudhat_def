import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setAccessToken, setSessionLostHandler } from "@/lib/api";
import type { CurrentUser, LoginResponse } from "@/types/api";

interface AuthState {
  user: CurrentUser | null;
  /** True until the initial silent refresh settles. */
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isBootstrapping, setBootstrapping] = useState(true);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionLostHandler(clear);
  }, [clear]);

  /**
   * The access token lives in memory, so a page refresh loses it. The
   * HttpOnly cookie survives, so a silent refresh restores the session —
   * this is what stops a hard refresh looking like a logout.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const restored = await api.refreshSession();
      if (cancelled) return;

      if (restored) {
        try {
          setUser(await api.get<CurrentUser>("/admin/auth/me"));
        } catch {
          clear();
        }
      }
      setBootstrapping(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [clear]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResponse>("/admin/auth/login", {
      email,
      password,
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/admin/auth/logout");
    } finally {
      // Clear locally even if the request fails — the user asked to leave,
      // and a stale in-memory token is worse than an orphaned server record.
      clear();
    }
  }, [clear]);

  const value = useMemo(
    () => ({ user, isBootstrapping, login, logout }),
    [user, isBootstrapping, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
