# Admin UI Architecture

> Scope: the admin application at `admin/`. A separate Vite + React + TypeScript SPA, deployed independently of the public site.
> Screens and permissions are specified in [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md). This document covers *how it is built*, not *what screens exist*.

---

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Build | Vite | Fast HMR, modern output, no CRA baggage |
| Language | **TypeScript** | The server is TypeScript; sharing request/response shapes across a language boundary would mean maintaining them twice |
| UI | React 18 | Consistent with the public site |
| Styling | Tailwind | New surface with no approved design to preserve — the reason it is rejected for the public site does not apply here |
| Components | shadcn/ui | Copy-in, not a dependency. Owned source that can be edited rather than fought |
| Data | TanStack Query | Server state is not client state; caching, refetch and mutation lifecycle are not worth hand-rolling |
| Routing | React Router 6 | Same as the public site |
| Forms | React Hook Form + zod | The server already validates with zod; the same schema shapes are reused |

**Change from [ARCHITECTURE.md](ARCHITECTURE.md):** that document originally listed JavaScript for the admin app. TypeScript is adopted instead — the API surface is large enough (40+ endpoints, 10 models) that untyped response handling would be a steady source of runtime bugs.

---

## 2. Deployment Shape

```
client/   public site      → dudhatdef.com
admin/    admin SPA        → dudhatdef.com/admin  (or admin.dudhatdef.com)
server/   shared API       → /api/v1
```

Two independent bundles. The admin app ships **nothing** to a public visitor — that is the whole reason it is separate ([ADMIN_PANEL_SPECIFICATION.md §2](ADMIN_PANEL_SPECIFICATION.md)).

They share no runtime code. If something genuinely needs sharing later (API types, zod schemas) it moves to a `shared/` package rather than being imported across app boundaries.

**Base path.** Vite `base: "/admin/"` and React Router `basename="/admin"`, so the app works when served from a sub-path. If it later moves to its own subdomain, both become `/` and the CORS allowlist gains the new origin.

---

## 3. Folder Structure

```
admin/src/
├─ main.tsx                  entry, providers
├─ App.tsx                   router
│
├─ app/
│  ├─ router.tsx             route table + guards
│  ├─ providers.tsx          QueryClient, auth, toaster
│  └─ queryClient.ts
│
├─ features/                 one folder per domain
│  ├─ auth/
│  │  ├─ AuthProvider.tsx    in-memory token + silent refresh
│  │  ├─ LoginPage.tsx
│  │  ├─ useAuth.ts
│  │  └─ auth.api.ts
│  ├─ dashboard/
│  ├─ leads/                 2E
│  ├─ media/                 2F
│  └─ catalogue/             2F
│
├─ components/
│  ├─ ui/                    shadcn primitives (generated, owned)
│  └─ common/                AppShell, Sidebar, Topbar, DataTable,
│                            EmptyState, ErrorState, PageHeader
│
├─ lib/
│  ├─ api.ts                 fetch wrapper: envelope unwrap, refresh-on-401
│  ├─ queryKeys.ts
│  ├─ permissions.ts         role matrix, mirrored from the server
│  └─ format.ts              dates, numbers, relative time
│
└─ types/
   └─ api.ts                 response shapes
```

**Feature-first, not layer-first.** Everything a lead screen needs lives under `features/leads/`. The alternative — `components/`, `hooks/`, `api/` split by kind — means a single screen's code is scattered across four directories, and deleting a feature becomes archaeology.

`components/ui` and `components/common` are the exceptions: they are genuinely cross-feature.

---

## 4. Authentication Flow

The security decisions here are S12 in [SECURITY_TODO.md](SECURITY_TODO.md) and are not negotiable in implementation.

```
Login
  POST /admin/auth/login  { email, password }
    → access token  → React state (memory only)
    → refresh token → HttpOnly cookie, set by the server

Every request
  Authorization: Bearer <access token from memory>

On 401
  POST /admin/auth/refresh   (cookie travels automatically)
    → success: retry the original request ONCE
    → failure: clear state, redirect to /login?next=<path>

On page load / hard refresh
  Access token is gone (memory). Call refresh silently.
    → success: restore session
    → failure: show login
```

**Access token in memory only.** Not `localStorage`, not `sessionStorage`, not a readable cookie. XSS that can read a token can impersonate the user for its full lifetime; XSS against an in-memory token is bounded by the page session.

**Exactly one retry.** A refresh that fails must not trigger another refresh. Concurrent 401s share a single in-flight refresh promise — otherwise ten parallel requests fire ten refreshes, and the server's reuse detection revokes the entire chain, logging the user out.

**Route guards are UX, not security.** They hide screens the role cannot use. Every endpoint is authorised server-side regardless; the client never decides access.

---

## 5. Data Layer

`lib/api.ts` is the only place that speaks HTTP.

- Unwraps the `{ success, message, data, meta }` envelope so components see `data`.
- Normalises failures into one `ApiError { message, errorCode, errors, status }`. Components never touch a raw response.
- Owns the refresh-on-401 flow.
- `credentials: "include"` so the refresh cookie travels.

**Query conventions**

| Setting | Value | Reason |
|---|---|---|
| `staleTime` | 30s | Admin data changes under you; the public site's 5 min would be wrong here |
| `refetchOnWindowFocus` | `true` | Opposite of the public site — returning to a lead board should show current data |
| `retry` | 1 for queries, **0 for mutations** | A retried POST can duplicate a lead or a note |
| Cache headers | `no-store`, server-side | Stale lead data in a sales workflow is worse than a round-trip |

Query keys are centralised in `lib/queryKeys.ts` so invalidation is never guessed at.

---

## 6. Design System

**Productivity-focused, not brand-focused.** The admin panel is a tool. Density beats drama in a table someone reads forty times a day.

**Inherited from the brand** — so the panel is recognisably the same product: `--color-navy #0a2a5e` as primary, `--color-green #2e9e4f` for success and positive deltas, Poppins.

**Not inherited:** the public site's spacing scale, hero patterns, card shadows, or section rhythm. Those are tuned for a marketing page and waste vertical space in a data view.

| Token | Admin value |
|---|---|
| Base font size | 14px (public site is 16px) |
| Row height | 40px comfortable / 32px compact |
| Radius | 6px (public site uses 10–16px) |
| Shadow | Borders over shadows; one elevation level for popovers only |
| Primary | `#0a2a5e` |
| Status colours | new `#0a2a5e` · contacted `#0891b2` · qualified `#7c3aed` · quotation_sent `#d97706` · won `#2e9e4f` · lost `#64748b` |

**Status colours are semantic, not decorative.** They map 1:1 to the lead pipeline in [DATABASE_ARCHITECTURE.md §5.7](DATABASE_ARCHITECTURE.md) and must stay consistent between the list, the board and the dashboard — a status that is amber in one view and purple in another costs more than it saves. Every status is also labelled in text; colour is never the only signal.

---

## 7. Animation Policy

**Default: none.**

Permitted, because their absence is confusing rather than merely plainer:

| Case | Duration |
|---|---|
| Popover / dropdown / modal open | ≤ 150ms fade |
| Toast enter/exit | ≤ 200ms |
| Skeleton shimmer | continuous, subtle |
| Button loading spinner | continuous |

Explicitly not used: page transitions, list stagger, scroll-triggered reveals, layout animation, parallax, anything decorative.

Rationale: an animation the user sees forty times a day is forty delays. Every permitted case above communicates state — something appeared, something is loading. Everything else is cost.

All motion respects `prefers-reduced-motion`.

---

## 8. Component Conventions

**Four states, every screen.** Loading (skeletons matching final layout, never a spinner over content), empty (explains what will appear and how), error (what failed, with retry), partial (data present, background refetch indicated). No screen may show an infinite spinner or a bare blank.

**`DataTable` is one component.** Leads, products, media and users all use it. Sorting, pagination, row selection, and column visibility are configured, not reimplemented. Four bespoke tables is how four inconsistent tables happen.

**Forms.** React Hook Form + zod, validating on blur and submit. Server field errors from `ApiError.errors` map back onto form fields by name — the server's `{ field, message }` shape exists for exactly this. Unsaved changes prompt before navigation.

**Confirmations** for destructive and outward-facing actions: any delete, publish/unpublish, bulk operations over 10 records, and lead export. The export dialog states the row count, because it is the panel's largest data egress.

**Accessibility.** Keyboard-operable throughout, visible focus rings, real `<label>` elements (never placeholder-as-label — the defect the public `ContactForm` has), WCAG AA contrast, `aria-live` for toasts and save states, tables with proper headers and scope.

---

## 9. Responsive

Desktop-first — this is a back office, and the mobile-first rule in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) governs the public site.

The mobile path is not optional for three screens: **lead list, lead detail, and status updates**. Sales staff triage leads in transit. Product and page editors are desktop-only and show an explicit "open on a larger screen" notice rather than a broken layout.

---

## 10. Security Requirements

Binding on implementation. Source: [SECURITY_TODO.md](SECURITY_TODO.md) S12.

- Access token in memory only.
- No `dangerouslySetInnerHTML` except for the sanitised product `description`, behind one reviewed wrapper component — and not until S1 ships.
- `<meta name="robots" content="noindex, nofollow">`; never linked from the public site.
- No secrets in the bundle. `VITE_*` is public by construction; only `VITE_API_URL` qualifies.
- Source maps not published to production.
- Route guards hide, they do not protect.
- `lib/permissions.ts` mirrors the server matrix for UI purposes only. When the two disagree, the server wins and the client is the bug.

---

## 10a. Rich Text

Tiptap, constrained to the allowlist in [RICH_TEXT_EDITOR_DECISION.md](RICH_TEXT_EDITOR_DECISION.md). The editor config **matches** the allowlist; it is never widened to enable a toolbar control.

**Code-split.** ProseMirror is ~126KB gzipped and is needed only inside the product editor. It loads on that route, not on the login screen — the main bundle stays at ~109KB.

**No image button, by design.** Images belong in the media library with alt text, dimensions and `usageCount` tracking. An `<img>` pasted into prose has none of that and would bypass the delete guard.

The editor is defence in depth. Server-side sanitisation is the control.

## 11. Build Order

| Unit | Contents |
|---|---|
| **2D** | Scaffold, Tailwind + shadcn, auth flow, app shell, routing, dashboard reading real KPIs |
| **2E** | Lead list, detail, pipeline board, profile + sessions |
| **2F** | ✅ Media library, product editor, categories, SEO panel, profile + change password |
| **4** | Users, activity log, saved views, global search, notifications |

2D delivers a working login and shell against the live API. It is scaffolding — the panel does not earn its keep until the lead screens land in 2E.
