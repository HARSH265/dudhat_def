/**
 * The only place in the app that speaks HTTP.
 *
 * Owns: envelope unwrapping, error normalisation, and the refresh-on-401
 * flow. Components never see a raw Response, never see the
 * { success, message, data } wrapper, and never touch a token.
 *
 * docs/ADMIN_UI_ARCHITECTURE.md §5, docs/SECURITY_TODO.md S12
 */

const BASE = import.meta.env["VITE_API_URL"] ?? "";
const API = `${BASE}/api/v1`;

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  // Declared explicitly rather than as constructor parameter properties —
  // `erasableSyntaxOnly` forbids the shorthand, since it emits runtime code.
  readonly status: number;
  readonly errorCode: string | undefined;
  readonly errors: FieldError[] | undefined;

  constructor(
    message: string,
    status: number,
    errorCode?: string,
    errors?: FieldError[]
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.errors = errors;
  }

  /** Maps server field errors back onto form fields by name. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.errors ?? []) out[e.field] = e.message;
    return out;
  }
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PageMeta;
  errorCode?: string;
  errors?: FieldError[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

// --- token, in memory only ------------------------------------------------
// Never localStorage or sessionStorage: XSS that can read a persisted token
// impersonates the user for its full lifetime. docs/SECURITY_TODO.md S12

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setSessionLostHandler(fn: () => void): void {
  onSessionLost = fn;
}

// --- refresh --------------------------------------------------------------

/**
 * Concurrent 401s share ONE in-flight refresh. Without this, ten parallel
 * requests fire ten refreshes; the server's reuse detection sees a rotated
 * token presented twice, revokes the whole chain, and logs the user out.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API}/admin/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const body = (await res.json()) as Envelope<{ accessToken: string }>;
      accessToken = body.data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so callers awaiting this promise all read
      // the same result before a new attempt can start.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

// --- request --------------------------------------------------------------

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Internal: prevents a refresh loop. */
  _retried?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  const { body, _retried, headers, ...rest } = options;

  const isFormData = body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined
      ? { body: isFormData ? body : JSON.stringify(body) }
      : {}),
  });

  // Exactly one retry. A failed refresh must never trigger another.
  if (res.status === 401 && !_retried) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, { ...options, _retried: true });
    }
    accessToken = null;
    onSessionLost?.();
    throw new ApiError("Your session has expired. Please sign in again.", 401, "TOKEN_EXPIRED");
  }

  // CSV export and similar non-JSON responses.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new ApiError("Request failed.", res.status);
    return { success: true, message: "", data: (await res.blob()) as T };
  }

  const payload = (await res.json()) as Envelope<T>;

  if (!res.ok || !payload.success) {
    throw new ApiError(
      // The server guarantees `message` is safe to show a user.
      payload.message || "Something went wrong.",
      res.status,
      payload.errorCode,
      payload.errors
    );
  }

  return payload;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return (await request<T>(path)).data;
  },

  /** For list endpoints, which carry pagination in `meta`. */
  async getPaged<T>(path: string): Promise<Paged<T>> {
    const res = await request<T[]>(path);
    return {
      items: res.data,
      meta: res.meta ?? {
        page: 1,
        limit: res.data.length,
        total: res.data.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    return (await request<T>(path, { method: "POST", body })).data;
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    return (await request<T>(path, { method: "PUT", body })).data;
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return (await request<T>(path, { method: "PATCH", body })).data;
  },

  async delete<T>(path: string): Promise<T> {
    return (await request<T>(path, { method: "DELETE" })).data;
  },

  refreshSession,
};

/** Query string builder that drops empty values rather than sending `?x=`. */
export function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}
