# Project Index

> **New session — read exactly three files before deciding anything:**
> 1. `CLAUDE.md` (root, auto-loaded) · 2. [PROJECT_STATUS.md](PROJECT_STATUS.md) · 3. this file
>
> Then route below and read the **one or two** documents your task lists.
> Hierarchy and what is archived: [DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md).

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
| Schema / collection / index work | `DATABASE_ARCHITECTURE.md` + **`MONGOOSE_GOTCHAS.md`** | `API_SPECIFICATION.md` unless the contract changes |
| **Any repository / query / session / token work** | **`MONGOOSE_GOTCHAS.md` first** | Everything else — it is short and it is mandatory |
| Product or packaging modelling | `PRODUCT_DATA_MODEL.md` + `SEED_DATA.md` §1, §3 | `DATABASE_ARCHITECTURE.md` (product section is duplicated there in summary only) |
| Build a React component | `COMPONENT_ARCHITECTURE.md` §0, §3, §4 | Backend docs |
| Build a CMS section renderer | `COMPONENT_ARCHITECTURE.md` §6 + `DATABASE_ARCHITECTURE.md` §5.6 | — |
| Admin panel screen | `ADMIN_PANEL_SPECIFICATION.md` + `ADMIN_UI_ARCHITECTURE.md` | Public-site docs |
| Any security question | `SECURITY_TODO.md` first, then `SECURITY_ARCHITECTURE.md` | Everything else |
| Auth / permissions | `ADMIN_PANEL_SPECIFICATION.md` §4 + `API_SPECIFICATION.md` §5.1 | `SECURITY_ARCHITECTURE.md` unless changing the model |
| Security control or review | `SECURITY_ARCHITECTURE.md` | — |
| Meta tags, sitemap, structured data | `SEO_ARCHITECTURE.md` | — |
| Performance / Core Web Vitals | `SEO_ARCHITECTURE.md` §6 | — |
| "What do I work on next?" | `PROJECT_STATUS.md` §6 | Everything else |
| "What is the state of the project?" | `PROJECT_STATUS.md` | Everything else — it is the living status doc |
| Planning or starting Phase 3 | `PHASE_3_PLAN.md` + `PHASE_3_READINESS_REPORT.md` | `IMPLEMENTATION_ROADMAP.md` (superseded for Phase 3) |
| Writing or running tests | `TESTING_STRATEGY.md` | Everything else |
| Fixing Phase 1 debt | `PHASE_1_REVIEW.md` | Everything else — it names the file and line |
| Catalogue / publish gate work | `PHASE_2C_REVIEW.md` + `PRODUCT_DATA_MODEL.md` | Everything else |
| Rich text / description field | `RICH_TEXT_EDITOR_DECISION.md` | Everything else — it carries the allowlist |
| Placeholder / dummy values | `SEED_DATA.md` | Everything else |
| Understand project purpose | `PROJECT_BIBLE.md` | Everything else |
| Adding or classifying a document | `DOCUMENTATION_STRUCTURE.md` | Everything else |

**Rule of thumb: 1–2 documents per task.** If you are opening a third, the task is too broad — split it.

---

## 2. Document Hierarchy

Full classification and merge/archive recommendations:
[DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md).

### Core — always read (7, capped)

| Document | Size | Answers |
|---|---|---|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | 6K | What is true now |
| PROJECT_INDEX.md *(this file)* | 9K | Which document for which task |
| [CLAUDE_RULES.md](CLAUDE_RULES.md) | 3K | Working rules |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 3K | Stack and layering |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | 2K | The design freeze |
| [MONGOOSE_GOTCHAS.md](MONGOOSE_GOTCHAS.md) | 19K | § Summary always; body before any query change |
| [SECURITY_TODO.md](SECURITY_TODO.md) | 20K | § Summary always; entry before touching what it covers |

### Reference — read when relevant (13)

| Document | Read when |
|---|---|
| [API_SPECIFICATION.md](API_SPECIFICATION.md) | Endpoint work |
| [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) | Schema, index, migration |
| [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) | Public-site components |
| [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) | Product/packaging modelling |
| [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) | What an admin screen contains; role matrix |
| [ADMIN_UI_ARCHITECTURE.md](ADMIN_UI_ARCHITECTURE.md) | How the admin app is built |
| [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) | Threat model, controls, PII |
| [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) | Rendering, metadata, CWV |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | Writing or running tests |
| [RICH_TEXT_EDITOR_DECISION.md](RICH_TEXT_EDITOR_DECISION.md) | **The allowlist — single documentary home** |
| [PHASE_3_PLAN.md](PHASE_3_PLAN.md) | Planning or executing Phase 3 |
| [SEED_DATA.md](SEED_DATA.md) | Placeholder values, launch gate |
| [PROJECT_BIBLE.md](PROJECT_BIBLE.md) | Why the project exists |

### Historical — do not read for current state (10)

All carry a HISTORICAL banner: `IMPLEMENTATION_PLAN` · `IMPLEMENTATION_ROADMAP`
(Phases 4–5 only) · `CMS_BLUEPRINT` · `FUTURE_DOCS` · `PHASE_1_REVIEW` ·
`PHASE_2C_REVIEW` · `PHASE_2E_SECURITY_REVIEW` · `PHASE_2F_REVIEW` ·
`PHASE_2F_HANDOVER` · `PHASE_3_READINESS_REPORT` (active until Phase 3 starts).

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
| `src/repositories/` | Queries only. `lead`, `user`, `refreshToken`, `media`, `catalogue`. **Read `MONGOOSE_GOTCHAS.md` before editing** | Query work |
| `src/validators/` | zod schemas: `contact`, `auth`, `lead`, `media`, `catalogue` | Input rules |
| `src/routes/admin/` | `index.ts` (mount + `authenticate`), `lead`, `media`, `catalogue` | Routing work |
| `src/middleware/` | `rateLimit`, `requestId`, `errorHandler`, `validate`, `authenticate`, `authorize`, `upload` | Cross-cutting work |
| `src/utils/` | `AppError`, `asyncHandler`, `crypto`, `jwt`, `phone`, `slug`, `fileType` | Shared helpers |
| `src/scripts/` | `syncIndexes`, `seedAdmin`, `seedSettings`, `migrateContactsToLeads`, `reconcileMediaUsage` | Ops tasks |
| `tsconfig.json` | `node16` modules, `strict`, `noUncheckedIndexedAccess` | Compiler config |
| `.env.example` | All 20 env vars, grouped by phase | Setting up |

---

---

## 4. State Lives Elsewhere

This file is a **routing table**. It deliberately holds no project state.

| Looking for | Read |
|---|---|
| Current phase, capabilities, open work, risks, next task | [PROJECT_STATUS.md](PROJECT_STATUS.md) |
| Documentation hierarchy and what is archived | [DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md) |
| How the project got here | The phase reviews — all marked HISTORICAL |

Sections 4–10 of this file previously duplicated PROJECT_STATUS and were
removed. Two files claiming current state drift apart; one of them then lies.
