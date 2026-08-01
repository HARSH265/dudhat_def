# Project Handover — as of Phase 2F

> **Frozen snapshot, taken at the end of Phase 2F.** Kept for the narrative —
> what was built, why, and what the decisions were.
>
> ⚠️ **For current project state, read [PROJECT_STATUS.md](PROJECT_STATUS.md).**
> That file is maintained; this one is not. Where they disagree, PROJECT_STATUS
> is right. Sections 3, 5, 6, 7, 8, 9 and 14 here are durable (history,
> decisions, schema, API, setup); sections 4, 10, 11, 12 and 15 will go stale.
>
> New session? Read PROJECT_STATUS.md, then `PROJECT_INDEX.md` for routing.

---

## 1. What This Is

**Dudhat DEF** — a MERN brochure site being converted into a CMS-driven lead generation platform for an Indian B2B manufacturer of Diesel Exhaust Fluid.

Goals: product showcase · lead generation · inquiry management. Every public page pushes toward Request Quote / Contact / Call / WhatsApp.

```
client/   public marketing site   React CRA, JavaScript   — 8 routes, UNTOUCHED except defect fixes
admin/    admin panel             Vite + React 19 + TS + Tailwind 4 + Tiptap
server/   API                     Express + TypeScript 7 + Mongoose
docs/     architecture            ~22 documents, routed by PROJECT_INDEX.md
```

Repo: `https://github.com/HARSH265/dudhat_def`, branch `main`. Everything committed and pushed.

---

## 2. Hard Rules (non-negotiable)

1. **The public design is frozen.** No redesign, rebrand, or new UI element in `client/`. Permitted without approval: responsiveness, accessibility, performance, and visually identical refactors. Anything that changes a pixel needs approval. `DESIGN_SYSTEM.md` § Design Freeze.
2. **The contact form must never break.** `ContactForm.jsx` → `POST /api/contact` is the only live conversion path, and it fails *silently* — leads just stop. The legacy alias is permanent.
3. **Read `MONGOOSE_GOTCHAS.md` before any repository, query, session or token change.** One trap there has caused five separate bugs.
4. **Never widen the rich-text allowlist to fit an editor feature.** `RICH_TEXT_EDITOR_DECISION.md`.
5. Controller → Service → Repository. No business logic in controllers.
6. No hardcoded content; no duplicated code; no secrets in code, logs or the client bundle.

---

## 3. Completed Phases

| Phase | Delivered |
|---|---|
| **0 — Stabilise** | Removed `GET /api/contact` (was returning all lead PII unauthenticated), git init, helmet, CORS allowlist, rate limiting, body limits, `robots.txt`, `h1` on all 8 pages, image dimensions, deleted 742KB of duplicate/unused assets |
| **1A** | Server → TypeScript, `src/`→`dist/`, connection lifecycle, graceful shutdown, validated env |
| **1B** | Service/repository layering, typed `AppError`, central error handler, `asyncHandler`, zod validation, pino with PII redaction |
| **1C** | Auth: users, refresh tokens, RBAC, audit log, bcryptjs cost 12, rotation with reuse detection |
| **1D** | Leads, lead activities, settings singleton, atomic counters, migration + seed scripts |
| **1 review** | 3 high / 6 medium / 11 low findings, high+medium fixed |
| **2A** | Lead management API, dashboard, user administration. Closed 3 Phase-1 deferrals |
| **2B** | Media API on Cloudinary — magic-byte detection, dedupe, replace, delete guard |
| **2C** | Categories + products, publish gate, media `usageCount` integration |
| **2D** | Admin app scaffold, auth flow, shell, dashboard |
| **2E** | Lead list, detail, pipeline board, per-user rate limits |
| **2E security** | Change-password, session endpoints, revocation reasons |
| **2F** | Media library UI, product editor with Tiptap, categories UI, SEO panel, profile, change-password UI, **S1 sanitisation** |

---

## 4. Remaining Phases

| Phase | Scope | Blocking dependency |
|---|---|---|
| **3 — Content cutover** | `pages` CMS + section renderer, React Query on the public site, **prerendering**, SEO metadata, sitemap, JSON-LD, redirects, `/products/:slug` | **Prerendering must ship BEFORE content moves to the CMS**, or the site regresses. `SEO_ARCHITECTURE.md` §2 |
| **4 — Frontend modernisation** | CRA → Vite, CSS Modules, responsive rewrite (desktop-first → mobile-first), accessibility, performance | Phase 3 |
| **5 — Growth** | Blog, dealer network, downloads, case studies | Phase 4 |

Admin work still outstanding: Settings screen, Users screen, activity log, packaging-variant editor, saved views, global search, notifications.

---

## 5. Architecture Decisions

| Decision | Choice | Why |
|---|---|---|
| Backend language | TypeScript 7 | `ts-node` is incompatible with TS 7; `tsx` needs a blocked esbuild postinstall. **Build is plain `tsc`** |
| Admin app | Separate Vite SPA at `/admin` | Shipping the CMS bundle to public visitors would harm the CWV the SEO goal depends on |
| Admin language | TypeScript | Changed from the original JS plan — 40+ endpoints across 10 models |
| Public styling | **Not Tailwind, not shadcn** | Would risk visual regression on a frozen design. CSS Modules + `variables.css` tokens |
| Admin styling | Tailwind 4 + shadcn conventions | New surface, no approved design to preserve |
| Rendering (public) | **Static prerendering at build** — decided, not built | `SEO_ARCHITECTURE.md` §2 |
| Product model | One product, four packaging variants | The 4 packaging images were byte-identical to the product images |
| Media storage | Cloudinary, streamed, nothing on server disk | |
| Rich text | **Tiptap** | Schema-driven: an unregistered extension *cannot* emit its node, so the allowlist becomes the editor config |
| Sanitisation | **sanitize-html**, server-side, on write | Pure JS, no build step; config maps directly onto the allowlist |

---

## 6. Security Decisions

- **Access token** 15 min, **in memory only** — never `localStorage`.
- **Refresh token** opaque, SHA-256 at rest, HttpOnly + Secure + SameSite=Strict, path-scoped, rotated every use.
- **Reuse detection fires only on `revokedReason: "rotated"`.** Administrative revocation (password change, logout, deactivation) is not an attack signal — treating it as one revoked sessions that a password change had deliberately preserved.
- **Password change keeps the calling session alive**, ends all others.
- **Password policy** matches common stems as *substrings*, not exact values — an exact-match list accepts `password123456`.
- **CSRF:** admin mutations authenticate by **bearer token only**. No state-changing endpoint may authenticate by cookie — that invariant *is* the control.
- **Unset `NODE_ENV` is treated as production.** Absence of config must not grant development relaxations.
- **IP addresses stored salted-hashed**, never raw.
- **Uploads:** magic bytes, not extension or Content-Type. SVG deliberately excluded.
- **Rich text sanitised on write**, never on render.

---

## 7. Rich Text — Editor and Allowlist

**Tiptap**, constrained down to the allowlist. **Never widen the allowlist to enable a toolbar control.**

**Tags (13):** `p` `br` `strong` `em` `u` `ul` `ol` `li` `a` `h2` `h3` `h4` `blockquote`

**Attributes:** only on `a` — `href` (schemes `http`/`https`/`mailto`/`tel` only), `title`, plus `rel` and `target` which are **forced**, not accepted.

**Never:** `style`, `class`, `id`, `on*`, `data-*`. No `h1` (page owns one), no `img` (media library owns images).

Implementation: `server/src/utils/richText.ts`. Sanitises on **write** — create, update, duplicate. Strips silently. Backfill: `npm run backfill:sanitize`.

Full rationale: `RICH_TEXT_EDITOR_DECISION.md`.

---

## 8. Database — 10 Collections

`users` · `refreshtokens` · `activitylogs` · `leads` · `leadactivities` · `settings` · `counters` · `media` · `categories` · `products`

Not yet built: `pages`, `redirects`, `pageviews` (Phase 3).

**Critical:** `autoIndex` is **off in production**. `unique: true` is an index directive, not a validator — with no index there is no uniqueness. Run `npm run sync:indexes` as a deploy step; `assertIndexes()` throws at boot if indexes are missing. A new model **must** be registered in `src/models/index.ts` or both miss it.

---

## 9. API Surface

**Public:** `POST /api/contact` (legacy alias, permanent) · `POST /api/v1/leads` · `GET /`

**Admin** — all under `/api/v1/admin`, `authenticate` at the mount, per-user rate limits:

```
auth/     login, refresh, logout, logout-all, me, change-password,
          sessions (GET), sessions/:id (DELETE),
          users (GET/POST), users/:id/status, users/:id/role
dashboard GET
leads     GET, POST, GET/:id, PATCH/:id, DELETE/:id,
          :id/notes, :id/assign, :id/spam, export
media     GET, POST upload, GET/:id, PUT/:id, POST/:id/replace, DELETE/:id
categories GET, POST, GET/:id, PUT/:id, PATCH/:id/status, DELETE/:id
products  GET, POST, GET/:id, PUT/:id, PATCH/:id/status,
          PATCH/reorder, POST/:id/duplicate, DELETE/:id
```

**Documented but NOT built:** `GET /api/v1/health`, `forgot-password`, `reset-password`, all public catalogue/page endpoints, `sitemap.xml`, `GET /media/:id/usage`.

---

## 10. Current Capabilities

**Admin can:** sign in, change password, view and revoke sessions, see dashboard KPIs, work leads (list/filter/search/detail/timeline/notes/assign/status/spam/export/board), upload and manage media, create and publish categories, create and edit products with rich text, specifications and SEO, and manage users.

**Admin cannot yet:** edit packaging variants in the UI, manage settings or view the activity log in the UI, edit page content (no `pages` collection), or reorder/duplicate/delete products from the UI.

**The CMS does not yet drive the public site.** All 8 public pages still have content hardcoded in JSX. That is Phase 3 and is the largest remaining gap.

---

## 11. Open Issues and Known Risks

| # | Item | Severity |
|---|---|---|
| 1 | **Public site content is still hardcoded** — the CMS exists but nothing consumes it | Highest remaining work |
| 2 | **Prerendering not built.** Moving content to the CMS *without it first* is a net SEO regression — an extra round-trip before any text exists | **Sequencing risk** |
| 3 | **Placeholder data must not reach production.** Specs are ISO limits, not measured results; company address/phone are placeholders. Publish gate blocks products; nothing blocks settings | Launch blocker |
| 4 | **Seed password not yet rotated** (owner action; UI now exists at `/admin/profile`) | Open |
| 5 | No tests, no CI, no dependency scanning | `SECURITY_TODO.md` S11 |
| 6 | `react-router-dom` has one unpatched advisory; RSC-mode only, not reachable in an SPA | Monitor |
| 7 | Logo changed from "DHUDHAT DEF" to "Dudhat DEF" during a rename — a visible change under the design freeze, unresolved | Needs a decision |
| 8 | 6 dead footer links (Privacy, Terms, 4 social) all point to `/` | Phase 3 |
| 9 | `Products.jsx` `subtitle` values are corrupted — do not migrate as volumes | Documented |

---

## 12. Deferred Items

From `SECURITY_TODO.md` (13 entries; S1, S2, S4-partial, S5-partial, S9 now closed):

- **S3** media hardening — signed URLs for drafts/certificates, re-encode, magic-byte tests
- **S4** `forgot-password`/`reset-password` (needs SMTP), 2FA
- **S5** server-side idle timeout, re-auth for sensitive actions
- **S7** CSP (needs deployed origins)
- **S8** SVG — six prerequisites documented; unscheduled
- **S10** audit-diff allowlist helper
- **S11** CI, `npm audit`, tests
- **S13** react-router advisory

Other: packaging-variant editor, `GET /media/:id/usage`, public catalogue endpoints, category `displayOrder` reorder.

---

## 13. Test Data — Do Not Delete Without Approval

Four seeded leads, still required for board, workflow, timeline, RBAC and dashboard regression checks. **There is no automated test suite**, so these are the only coverage that exists for lead workflows.

`DEF-2026-00001` new · `DEF-2026-00002` lost · `DEF-2026-00003` won · `DEF-2026-00004` quotation_sent

Keep until `TESTING_STRATEGY.md` is implemented.

---

## 14. Running It

```bash
npm --prefix server run dev      # API on :5000
npm --prefix admin run dev       # admin on :5173/admin
npm --prefix client start        # public site on :3000
```

`server/.env` needs: `NODE_ENV=development` (**required** — unset means production), `MONGO_URI`, `CLIENT_URL`, `ADMIN_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `IP_HASH_SALT`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

Scripts: `sync:indexes` · `seed:admin` · `seed:settings` · `migrate:leads` · `reconcile:media` · `backfill:sanitize` · `typecheck`.

---

## 15. Next Recommended Task

**Phase 3, starting with prerendering — before any content moves to the CMS.**

Rationale: public page copy currently lives in the JS bundle. Moving it to an API call *without* prerendering puts it behind an extra network round-trip, which is measurably worse for both SEO and LCP on a project whose first stated rule is "SEO First". Prerendering first makes the cutover neutral-to-positive.

Order within Phase 3:
1. Static prerendering (Vite) — **decision made, needs sign-off before build**
2. `pages` collection + section registry + 10 section renderers
3. React Query on the public site; `ContactForm` onto `useSubmitLead` behind the legacy alias
4. Page-by-page migration, lowest traffic first: Sustainability → About → Quality → Why DEF → Packaging → Products → Contact → **Home last**
5. SEO metadata, `sitemap.xml`, JSON-LD, redirects

**Before that, two cheap high-value items:** rotate the seed password (UI now exists), and write `TESTING_STRATEGY.md` starting with the nine security checks in `SECURITY_ARCHITECTURE.md` §12 — three shipped bugs so far returned a plausible response while doing nothing, and only consequence-testing caught them.
