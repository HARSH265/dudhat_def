# Project Index

Routing table. Find your task, read only the listed files.

**Do not read documents not listed for your task.** Every doc here is self-contained on its subject and cross-references the rest by section number — follow a link only when the current file explicitly points you there.

---

## 1. Task Routing

| Task | Read | Do not read |
|---|---|---|
| Fix a bug in existing code | The file + `CLAUDE_RULES.md` | Any architecture doc |
| Change styling / CSS | `DESIGN_SYSTEM.md` + the component file | Everything else |
| Responsive / breakpoint work | `DESIGN_SYSTEM.md` § Responsive | Architecture docs |
| Add or change an API endpoint | `API_SPECIFICATION.md` | `ADMIN_PANEL_SPECIFICATION.md`, `SEO_*` |
| Schema / collection / index work | `DATABASE_ARCHITECTURE.md` | `API_SPECIFICATION.md` unless the contract changes |
| Product or packaging modelling | `PRODUCT_DATA_MODEL.md` + `SEED_DATA.md` §1, §3 | `DATABASE_ARCHITECTURE.md` (product section is duplicated there in summary only) |
| Build a React component | `COMPONENT_ARCHITECTURE.md` §0, §3, §4 | Backend docs |
| Build a CMS section renderer | `COMPONENT_ARCHITECTURE.md` §6 + `DATABASE_ARCHITECTURE.md` §5.6 | — |
| Admin panel screen | `ADMIN_PANEL_SPECIFICATION.md` + `ADMIN_UI_ARCHITECTURE.md` | Public-site docs |
| Any security question | `SECURITY_TODO.md` first, then `SECURITY_ARCHITECTURE.md` | Everything else |
| Auth / permissions | `ADMIN_PANEL_SPECIFICATION.md` §4 + `API_SPECIFICATION.md` §5.1 | `SECURITY_ARCHITECTURE.md` unless changing the model |
| Security control or review | `SECURITY_ARCHITECTURE.md` | — |
| Meta tags, sitemap, structured data | `SEO_ARCHITECTURE.md` | — |
| Performance / Core Web Vitals | `SEO_ARCHITECTURE.md` §6 | — |
| "What do I work on next?" | `IMPLEMENTATION_ROADMAP.md` | Everything else |
| Fixing Phase 1 debt | `PHASE_1_REVIEW.md` | Everything else — it names the file and line |
| Catalogue / publish gate work | `PHASE_2C_REVIEW.md` + `PRODUCT_DATA_MODEL.md` | Everything else |
| Placeholder / dummy values | `SEED_DATA.md` | Everything else |
| Understand project purpose | `PROJECT_BIBLE.md` | Everything else |

**Rule of thumb: 1–2 documents per task.** If you are opening a third, the task is too broad — split it.

---

## 2. Document Map

| Document | Size | Answers |
|---|---|---|
| `PROJECT_BIBLE.md` | XS | Why this project exists, who buys, what counts as success |
| `CLAUDE_RULES.md` | XS | Working constraints |
| `ARCHITECTURE.md` | S | Stack, layering, current vs target |
| `DESIGN_SYSTEM.md` | S | Design freeze, breakpoints, UI rules |
| `CMS_BLUEPRINT.md` | XS | CMS module scope |
| `SEED_DATA.md` | M | Every placeholder value + replacement checklist |
| `PRODUCT_DATA_MODEL.md` | L | Product, variants, specifications, structured data |
| `DATABASE_ARCHITECTURE.md` | XL | 11 collections, indexes, migrations |
| `API_SPECIFICATION.md` | XL | 62 endpoints, conventions, middleware |
| `COMPONENT_ARCHITECTURE.md` | L | Frontend layers, section renderer, data layer |
| `ADMIN_PANEL_SPECIFICATION.md` | L | 14 screens, roles, permissions |
| `SECURITY_ARCHITECTURE.md` | L | Threat model, controls, PII, verification |
| `SEO_ARCHITECTURE.md` | L | Rendering strategy, metadata, CWV |
| `IMPLEMENTATION_ROADMAP.md` | M | Phases, gates, dependencies, blocking decisions |
| `IMPLEMENTATION_PLAN.md` | XS | Superseded — do not read |

---

## 3. Codebase Map

Read a source file only when changing it. This table replaces exploratory reading.

### `client/src/` — public site (CRA, 8 routes)

| Path | Contains | Read when |
|---|---|---|
| `App.js` | Router, 8 routes, Navbar/Footer shell | Adding a route |
| `index.js` | React root, CSS imports | Almost never |
| `styles/variables.css` | **Design tokens** — colours, fonts, spacing, radius, shadow | Any styling task |
| `index.css` | Reset + base element styles (35 lines) | Rarely |
| `App.css` | **888 lines, ~71 global classes, 9 `max-width` queries** | Only the block you are changing — never the whole file |
| `components/Button.jsx` | Polymorphic Link/anchor/button | Reusing or extending it |
| `components/ProductCard.jsx` | Card; **button is inert** | Product grid work |
| `components/FeatureCard.jsx` | Icon + title + description | Feature strip work |
| `components/ContactForm.jsx` | **The only conversion path.** Local state + inline axios | Any lead-capture change |
| `components/Navbar.jsx` | Hardcoded nav array, mobile toggle | Nav work |
| `components/Footer.jsx` | Hardcoded links, contact, social. **3 dead links** | Footer work |
| `pages/*.jsx` | 8 pages, each with content hardcoded in local arrays | Migrating that page to CMS |
| `assets/images/` | 14 PNGs, 8.3MB, unoptimised | Never read — reference by path |

### `server/` — API (Express + TypeScript, 40+ endpoints)

Source in `src/`, compiled to `dist/`. Run `npm run dev` (watch) or `npm run build && npm start`. `npm run typecheck` for types only.

| Path | Contains | Read when |
|---|---|---|
| `src/server.ts` | Bootstrap: connect DB, listen, graceful shutdown | Startup/shutdown work |
| `src/app.ts` | Express assembly: helmet, CORS allowlist, body limits, routes, 404, error handler | Middleware work |
| `src/config/env.ts` | Validated env access; throws a named error on a missing required var | Adding an env var |
| `src/config/db.ts` | Mongoose connect, pool options, lifecycle listeners, `sanitizeFilter` | Connection work |
| `src/models/` | 10 models + `index.ts` registry + `shared.ts` (SeoMeta, ContentStatus) | Schema work |
| `src/models/index.ts` | **Model registry.** A new model must be added here or index sync and the startup assertion miss it | Adding a model |
| `src/controllers/` | `contactController` (public lead), `auth`, `lead`, `media`, `catalogue` | Endpoint work |
| `src/services/` | Business logic. `leadAdmin`, `auth`, `media`, `category`, `product`, `mediaUsage`, `dashboard`, `audit` | Any rule change |
| `src/repositories/` | Queries only. `lead`, `user`, `refreshToken`, `media`, `catalogue` | Query work |
| `src/validators/` | zod schemas: `contact`, `auth`, `lead`, `media`, `catalogue` | Input rules |
| `src/routes/admin/` | `index.ts` (mount + `authenticate`), `lead`, `media`, `catalogue` | Routing work |
| `src/middleware/` | `rateLimit`, `requestId`, `errorHandler`, `validate`, `authenticate`, `authorize`, `upload` | Cross-cutting work |
| `src/utils/` | `AppError`, `asyncHandler`, `crypto`, `jwt`, `phone`, `slug`, `fileType` | Shared helpers |
| `src/scripts/` | `syncIndexes`, `seedAdmin`, `seedSettings`, `migrateContactsToLeads`, `reconcileMediaUsage` | Ops tasks |
| `tsconfig.json` | `node16` modules, `strict`, `noUncheckedIndexedAccess` | Compiler config |
| `.env.example` | All 20 env vars, grouped by phase | Setting up |

---

## 4. Known State — Do Not Re-Derive

Facts already established. Trust these instead of re-investigating.

**Phase 0, Phase 1 and Phase 2A–2E are complete.** See §5–10. The admin app lives in `admin/` — see `ADMIN_UI_ARCHITECTURE.md`.

**Stack:** CRA 5.0.1 (not Vite), **TypeScript 7 backend**, Cloudinary media, 10 collections. No React Query, no Tailwind, no tests, no admin UI yet.

**Toolchain notes worth not rediscovering:** TypeScript 7.0.2 is the native port — `ts-node` is incompatible with it (targets the TS 5.x API) and `tsx` needs an esbuild binary whose postinstall is blocked here. Build is plain `tsc`. `moduleResolution: node10` was removed in TS 7; use `node16`. Node 24 can run `.ts` natively if a loader is ever needed.

**Rule violations in current code:** content hardcoded in all 8 pages · `Products.jsx`/`Packaging.jsx` and `About.jsx`/`Sustainability.jsx` are near-duplicates · validation + business logic + persistence all inside `contactController.submitContact`.

**Data defects:** `Products.jsx` `subtitle` values are misaligned (10L Can → `"18L"`, 20L Can → `"10L"`, 210L Drum → `"350L"`). Do not migrate them as volumes.

**CSS:** desktop-first (9 `max-width` queries, 6 ad-hoc breakpoints), `!important` at `App.css:551` and `App.css:599`, container width split 1300px/1400px.

**Missing from `client/public/`:** favicon, `manifest.json`, `sitemap.xml`.

**Placeholders in production code:** phone `+91 12345 67890`, address `Plot No. ___, MIDC, ________`, 6 dead footer links (Privacy, Terms, 4 social) all pointing to `/`. Deferred to Phase 3 — fixing them changes rendered output, which the design freeze forbids without approval.

---

## 5. Phase 0 — Done

| Change | Where |
|---|---|
| `GET /api/contact` removed (was exposing all lead PII) | `routes/contactRoutes.js`, `controllers/contactController.js` |
| Git repository initialised; remote `origin` → `HARSH265/dudhat_def` | — |
| `helmet`, CORS origin allowlist, 100kb body limit, `trust proxy`, `x-powered-by` off, CORS error handler | `server/server.js` |
| Rate limiting — 5/IP/hour on lead capture, 300/15min global | `server/middleware/rateLimit.js` |
| `robots.txt` added | `client/public/` |
| `h1` added to all 8 pages (was 1 of 8) | `pages/*.jsx` + 3 selectors in `App.css` |
| `width`/`height` on all rendered images; `height: auto` on the global `img` rule | 7 component/page files, `index.css` |
| `hero-truck.png` + 4 duplicate `packaging/*.png` deleted (742KB) | `assets/images/` |
| `.env.example` populated (20 vars) | `server/` |

**Outstanding from Phase 0:** favicon (needs a real 32×32 + 180×180 asset) · credential rotation and Search Console verification (owner-side).

---

## 6. Phase 1A — Done

Server converted to TypeScript, `src/` → `dist/`.

| Change | Where |
|---|---|
| 6 JS files → 8 TS files under `src/`; `strict` + `noUncheckedIndexedAccess` | `server/src/` |
| Express assembly split out of the bootstrap, so the app is constructible without listening (needed for tests) | `src/app.ts`, `src/server.ts` |
| Validated env access; missing required vars throw a named error at boot | `src/config/env.ts` |
| `connectDB` no longer calls `process.exit(1)` — it rejects and the bootstrap reports. Pool options and lifecycle listeners added | `src/config/db.ts` |
| `strictQuery` + `sanitizeFilter` on; `autoIndex` off in production | `src/config/db.ts` |
| Graceful shutdown on SIGTERM/SIGINT with a 10s backstop | `src/server.ts` |
| JSON 404 handler (was falling through to Express's HTML default) | `src/app.ts` |
| `X-Frame-Options: DENY` (helmet defaults to SAMEORIGIN) | `src/app.ts` |
| Lead response returns `{ id }` instead of the whole document | `src/controllers/contactController.ts` |

**Verified at runtime:** Atlas connects · `GET /` 200 · `GET /api/contact` 404 · `POST /api/contact` returns the byte-identical legacy 400 message · HSTS, nosniff, frameguard, and RateLimit headers present · `x-powered-by` absent.

---

## 7. Phase 1B–1D — Done

**1B — layering, errors, validation.** Controller → Service → Repository split. Typed `AppError` + single central error handler. `asyncHandler` wrapper (Express 4 does not forward async rejections). zod validation as middleware, unknown keys **stripped** — verified that `role` in a request body does not reach the document. Honeypot accepted with 201 and discarded. Full middleware stack in documented order. pino with a redaction list covering credentials and lead PII.

**1C — auth, RBAC, audit.** `User` / `RefreshToken` / `ActivityLog`. bcryptjs cost 12. Access token 15m in the body; refresh token in an HttpOnly, SameSite=Strict, path-scoped cookie, rotated on use with reuse detection. Per-account lockout + per-IP throttle. Enumeration resistance verified. `authenticate` re-reads the user each request so deactivation takes effect immediately. `npm run seed:admin` prints a one-time generated password.

**1D — leads, activities, settings.** `Lead` (full schema, 9 indexes, status state machine), `LeadActivity` (append-only), `Settings` (singleton), `Counter` (atomic lead numbers — never `countDocuments`). Lead capture now writes a `Lead` + a `created` activity. Spam scoring flags rather than blocks.

### Scripts

```
npm run seed:admin -- <email> "<name>"    create the first superadmin
npm run seed:settings                     seed the settings singleton
npm run migrate:leads                     contacts -> leads (idempotent)
```

### Bug found during 1C testing

`revokeAllForUser` filtered on `{ revokedAt: { $exists: false } }`. Mongoose casts that operator object against the Date path and throws, so the query failed and **reuse detection never revoked anything** — a stolen refresh token would have kept working. Now filters on `revokedAt: null`. Note `$gte` is unaffected; the problem is specific to `$exists` on a typed path.

### Endpoints now live

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/contact` | none — legacy alias, permanent |
| `POST` | `/api/v1/leads` | none |
| `POST` | `/api/v1/admin/auth/login` | none |
| `POST` | `/api/v1/admin/auth/refresh` | cookie |
| `POST` | `/api/v1/admin/auth/logout` | cookie |
| `GET` | `/api/v1/admin/auth/me` | Bearer |
| `POST` | `/api/v1/admin/auth/users` | Bearer, superadmin |

**Outstanding:** `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are not in `server/.env` — development falls back to ephemeral secrets with a startup warning, so sessions do not survive a restart. Production **throws** without them.

**Not built in Phase 1** (deferred to Phase 2 with the admin panel): lead list/detail/update endpoints, password reset, `logout-all`, `maintenanceGuard`.

---

## 8. Phase 2A — Done

Lead management API. Closes all three Phase 1 deferrals (M4, M5, L4).

| Added | Notes |
|---|---|
| `GET/POST /admin/leads`, `GET/PATCH/DELETE /admin/leads/:id` | List with filters, search, pagination; detail with timeline |
| `POST /admin/leads/:id/notes` · `/assign` · `/spam` | Every mutation writes a `leadactivities` entry |
| `GET /admin/leads/export` | CSV, capped at 5000 rows, rate-limited 5/hour, audit-logged with row count |
| `GET /admin/dashboard` | The four KPI cards + status/source breakdowns + daily series |
| `GET/PATCH /admin/auth/users/:id/status`, `/role`, `GET /users` | User management with escalation guards |
| `POST /admin/auth/logout-all` | Closes L4 |
| `validateQuery` + `query()` helpers | Parsed query stashed on `res.locals`, not `req.query` — Express 5 makes that a getter |

**M4 now enforced.** `STATUS_TRANSITIONS` is consulted in `leadAdmin.service.ts`. Verified: `new → won` returns 409 naming the allowed targets; `→ lost` without a reason returns 400; `lost → contacted` returns 409 as terminal. `firstContactedAt` and `closedAt` are stamped automatically.

**M5 now enforced.** Self-role-change and self-deactivation are blocked, and a last-active-superadmin cannot be demoted or deactivated. Note the precedence: the self-check fires first, so in a single-superadmin deployment that is the guard doing the work.

**Role boundaries verified:** `editor` gets 403 on lead routes, and assigning a lead *to* an editor returns 400 — content roles hold no customer contact data.

**CSV formula injection guarded:** cells beginning `= + - @` are apostrophe-prefixed. Confirmed on the phone column, which starts with `+`.

**Known gap:** `productViews` on the dashboard returns `null` until `pageviews` arrives with the catalogue in 2C. Returning a fabricated number would be worse.

**Validation note worth knowing:** the lead `name` pattern rejects digits, so `"Buyer 1"` is a 400. Intentional, but it surprises when writing test data.

---

## 9. Phase 2B — Done

Media API on Cloudinary. `GET/POST /admin/media`, `/upload`, `/:id`, `/:id/replace`, `DELETE /:id`.

**Security decisions worth not re-litigating:**

**SVG is not on the allowlist.** SVG is XML and executes script; accepting it safely needs a real DOM-parsing sanitiser. [SECURITY_ARCHITECTURE.md §7](SECURITY_ARCHITECTURE.md) says drop the format rather than ship a weak sanitiser, and nothing needs it — the logo is a PNG. Revisit only with a proper sanitiser.

**Magic bytes are hand-rolled in `utils/fileType.ts`**, not from `file-type`. The allowlist is four fixed formats, the checks are a dozen bytes each, and `file-type` is ESM-only which fights this CommonJS build. Verified: an SVG-with-script renamed `.png` is rejected, as are GIF bytes named `.png`.

**Dimensions are parsed from the file header** (PNG IHDR, JPEG SOF, WebP VP8/VP8L) so `width`/`height` are stored at upload — that is what lets the front end reserve layout space and avoid CLS.

**Nothing touches server disk.** Multer memory storage, streamed to Cloudinary. No temp directory, no path traversal via filename, no leftovers.

**Filenames are regenerated** (`sanitised-stem-<uuid8>`); the client's name is kept only as a display label.

**Dedupe by SHA-256** — re-uploading identical bytes returns the existing record with `wasDuplicate: true` rather than making a second copy.

**Delete is blocked while `usageCount > 0`** and returns 409 naming the count. Replace keeps the same `_id`, so every embedded reference picks up the new file; the old binary is destroyed only *after* the record points at the new one.

**Batch uploads are sequential, not parallel** — 10 × 5MB in parallel would hold 50MB in memory and open 10 streams.

**Env naming:** Cloudinary's dashboard labels its credentials "API Key"/"API Secret", so they often land in `.env` unprefixed. Both `CLOUDINARY_API_KEY` and bare `API_KEY` are read, prefixed wins, and the fallback warns — a bare `API_KEY` will collide with the next service added.

**Not built yet:** `GET /media/:id/usage` (needs the catalogue in 2C to have referrers), and `usageCount` is only ever incremented by `incrementUsage` — nothing calls it until products reference media.
