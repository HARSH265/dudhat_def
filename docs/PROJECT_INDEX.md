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
| Admin panel screen | `ADMIN_PANEL_SPECIFICATION.md` | Public-site docs |
| Auth / permissions | `ADMIN_PANEL_SPECIFICATION.md` §4 + `API_SPECIFICATION.md` §5.1 | `SECURITY_ARCHITECTURE.md` unless changing the model |
| Security control or review | `SECURITY_ARCHITECTURE.md` | — |
| Meta tags, sitemap, structured data | `SEO_ARCHITECTURE.md` | — |
| Performance / Core Web Vitals | `SEO_ARCHITECTURE.md` §6 | — |
| "What do I work on next?" | `IMPLEMENTATION_ROADMAP.md` | Everything else |
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

### `server/` — API (Express + TypeScript, 1 endpoint)

Source in `src/`, compiled to `dist/`. Run `npm run dev` (watch) or `npm run build && npm start`. `npm run typecheck` for types only.

| Path | Contains | Read when |
|---|---|---|
| `src/server.ts` | Bootstrap: connect DB, listen, graceful shutdown | Startup/shutdown work |
| `src/app.ts` | Express assembly: helmet, CORS allowlist, body limits, routes, 404, error handler | Middleware work |
| `src/config/env.ts` | Validated env access; throws a named error on a missing required var | Adding an env var |
| `src/config/db.ts` | Mongoose connect, pool options, lifecycle listeners, `sanitizeFilter` | Connection work |
| `src/models/Contact.ts` | The only schema — 5 fields, no indexes. Superseded by `leads` in 1D | Lead model work |
| `src/controllers/contactController.ts` | `submitContact`; still validation + logic + persistence in one place | Lead endpoint work |
| `src/routes/contactRoutes.ts` | `POST /` only | Routing work |
| `src/middleware/rateLimit.ts` | `leadLimiter`, `globalLimiter` | Rate limit work |
| `tsconfig.json` | `node16` modules, `strict`, `noUncheckedIndexedAccess` | Compiler config |
| `.env.example` | All 20 env vars, grouped by phase | Setting up |

---

## 4. Known State — Do Not Re-Derive

Facts already established. Trust these instead of re-investigating.

**Phase 0 is complete.** See §5 for what it changed.

**Stack:** CRA 5.0.1 (not Vite), **TypeScript 7 backend**, no React Query, no Tailwind, no Cloudinary, no tests.

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

**Known gap carried to 1B:** `submitContact` still does validation, logic, and persistence in one function.

**Flagged for 1B:** `express@4` with async handlers requires explicit `try/catch` or a wrapper — Express 4 does not forward async rejections. Either add `asyncHandler` or upgrade to Express 5, which handles them natively. Decide before writing services.
