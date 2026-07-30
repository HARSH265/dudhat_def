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

### `server/` — API (Express, 2 endpoints)

| Path | Contains | Read when |
|---|---|---|
| `server.js` | Express bootstrap, `cors()` unrestricted, route mounting | Middleware work |
| `config/db.js` | Mongoose connect; `process.exit(1)` on failure | Connection work |
| `models/Contact.js` | The only schema — 5 fields, no indexes | Lead model work |
| `controllers/contactController.js` | `submitContact` + `getContacts`; validation + logic + persistence in one place | Lead endpoint work |
| `routes/contactRoutes.js` | `POST /` and `GET /` | Routing work |
| `.env.example` | Env var reference | Setting up |

---

## 4. Known State — Do Not Re-Derive

Facts already established. Trust these instead of re-investigating.

**Phase 0 is complete.** See §5 for what it changed.

**Stack:** CRA 5.0.1 (not Vite), JavaScript backend (not TypeScript), no React Query, no Tailwind, no Cloudinary, no tests.

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

**Outstanding from Phase 0:** favicon (needs a real 32×32 + 180×180 asset) · `CLIENT_URL`/`ADMIN_URL` in `server/.env` · credential rotation and Search Console verification (owner-side).
