# Implementation Roadmap

> Status: Planning document. No code written yet.
> Supersedes [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
> Objective: convert the current brochure site into a CMS-driven lead generation platform **without changing the approved design**.

This document sequences work already specified elsewhere. It does not restate what a phase builds — it states when, in what order, why that order, and what must be true before the next phase starts. Per-item detail lives in the linked documents.

---

## 0. Constraints Governing Every Phase

| Constraint | Source |
|---|---|
| Design is frozen — no redesign, no rebrand, no visual change | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) § Design Freeze |
| No hardcoded content; no duplicated code; no business logic in controllers | [CLAUDE_RULES.md](CLAUDE_RULES.md) |
| API contracts are not broken | [CLAUDE_RULES.md](CLAUDE_RULES.md), [API_SPECIFICATION.md](API_SPECIFICATION.md) §9 |
| The contact form never stops working | It is the only conversion path that currently exists |

That last one is the operating constraint of the whole project. `ContactForm.jsx` → `POST /api/contact` is live and is the site's sole lead capture. Every phase that touches it ships behind the legacy alias, and a broken form fails *silently* — no error appears anywhere, leads simply stop.

---

## 1. Phase Overview

| Phase | Name | Outcome | Blocking dependency |
|---|---|---|---|
| **0** | Stabilise | Data leak closed, work made reversible | None — start immediately |
| **1** | Backend foundation | Layered, validated, secured API + auth | Phase 0 |
| **2** | CMS core | Admin panel, media, products, leads | Phase 1 |
| **3** | Content cutover | Site reads from CMS; prerendering; SEO | Phase 2 + prerender decision |
| **4** | Frontend modernisation | Vite, CSS Modules, responsive rewrite | Phase 3 |
| **5** | Growth | Blog, dealer network, downloads | Phase 4 |

Phases 0–2 are backend-and-admin work that does not touch the public site at all. That is deliberate: it front-loads everything with the highest risk and the lowest visual impact, so the live site stays untouched until the CMS behind it actually works.

---

## 2. Phase 0 — Stabilise

**Nothing else starts until this is done.** Roughly one working day.

| # | Task | Reference | Why now |
|---|---|---|---|
| 0.1 | Delete `GET /api/contact` | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §1 | Every stored lead is currently readable by any anonymous caller. One-line change |
| 0.2 | `git init`, first commit | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §5 | No repository exists. Nothing below is reversible without it |
| 0.3 | Rotate `MONGO_URI` credentials, regenerate `JWT_SECRET` | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §5 | Both sat in plaintext outside version control |
| 0.4 | Populate `.env.example` (keys only) | [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §7 | Currently a zero-byte file |
| 0.5 | CORS allowlist, `helmet`, body size limit | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §1 | Config-only, no logic change |
| 0.6 | Rate limit on `POST /api/contact` | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §6 | The one public write endpoint, currently unthrottled |
| 0.7 | Verify Google Search Console | [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §9 | Collects no data before verification — every week delayed is baseline permanently lost |
| 0.8 | Add `robots.txt`, favicon | [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §7 | `client/public/` contains only `index.html` |
| 0.9 | Fix 3 dead footer links; add `width`/`height` to 13 images; fix `h1` on 3 pages | [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §7–8 | Zero visual change, immediate CLS and crawl benefit |

**Order within the phase:** 0.2 before everything, so every subsequent change is reversible. Then 0.1, which is the live leak.

**Gate:** repository initialised with a clean first commit · no unauthenticated route returns lead data · secrets rotated · contact form still submits successfully.

**Ordering note.** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) opened with "Convert to TypeScript". That is now Phase 1. A language migration is a maintainability improvement; an open lead database is an active loss. Sequencing the migration first would have left the leak open for the duration of the migration.

---

## 3. Phase 1 — Backend Foundation

Builds the layered architecture [ARCHITECTURE.md](ARCHITECTURE.md) already mandates but the code does not implement. The public site is untouched throughout.

| Group | Work | Reference |
|---|---|---|
| Layering | Controller → Service → Repository split; `asyncHandler`; central error handler; typed `AppError` | [API_SPECIFICATION.md](API_SPECIFICATION.md) §3 |
| Middleware | Full stack in documented order; request ID; structured logging | [API_SPECIFICATION.md](API_SPECIFICATION.md) §6 |
| Validation | Per-endpoint schemas; unknown-field stripping; `mongo-sanitize`; `sanitizeFilter` | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §6 |
| TypeScript | Convert `server/` to TS | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Connection | Fix `db.js` — remove `process.exit(1)`, add pool options and lifecycle handlers | [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §7 |
| Auth | `users`, `refreshtokens`; login/refresh/logout; RBAC middleware; audit log | [API_SPECIFICATION.md](API_SPECIFICATION.md) §5.1 |
| Leads | `contacts` → `leads` migration; `leadactivities`; legacy alias | [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §8 (M1) |
| Settings | `settings` singleton, seeded from current `Footer.jsx` literals | [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §8 (M4) |

**Sequencing within the phase:** layering and middleware first, because auth is built *on* them and retrofitting a service layer under a working auth module is more expensive than building auth on top of one. TypeScript conversion comes before auth for the same reason — converting a larger codebase costs more than converting a smaller one.

**Risk — the `contacts` → `leads` migration.** The only Phase 1 item touching live data. Mitigations: `contacts` stays read-only for one release as a rollback path; the legacy `POST /api/contact` alias keeps `ContactForm.jsx` working unchanged; response `message` strings stay byte-identical.

**Gate:** every admin route returns 401 without a token · role matrix enforced server-side and tested · legacy contact endpoint accepts a submission and stores a `leads` record · all existing contacts migrated with `leadNumber` assigned · no business logic remains in a controller.

---

## 4. Phase 2 — CMS Core

The admin panel becomes usable. Public site still untouched.

| Group | Work | Reference |
|---|---|---|
| Admin shell | Vite + React + Tailwind + shadcn app at `/admin`; login; layout; routing | [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §2–3 |
| Media | Cloudinary integration; `media`; library; picker modal; upload security | [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §5.10, [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §7 |
| Catalogue | `categories`, `products`; list + editor; asset migration | [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md), [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §8 (M2) |
| Leads | List, detail, pipeline board, timeline, assignment, export | [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §5.3–5.5 |
| Dashboard | Four KPI cards | [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §5.2 |
| Settings | Settings screens replacing hardcoded footer/contact values | [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §5.12 |

**Order within the phase:** media before catalogue — the product editor needs an image picker, and building it against a stub costs a rework. Leads can be built in parallel with catalogue by a second person; they share no code.

**Value note:** the lead screens are the first thing in this project that delivers business value. Everything before them is foundation. If the schedule slips, protect Phase 2 lead management and let the dashboard slip — a salesperson working leads in the panel is the point; KPI cards are decoration.

**No longer blocked.** The product-vs-packaging-variant question is resolved provisionally (Option B) and specification values are seeded as flagged placeholders — see [SEED_DATA.md](SEED_DATA.md). Catalogue work proceeds; publication does not, until the real Certificate of Analysis replaces the placeholder specifications.

**Gate:** an admin can log in, upload an image, create and publish a product, and work a lead from `new` to `won` · all four packaging variants and 13 images migrated · export audit-logged · no lead can be hard-deleted.

---

## 5. Phase 3 — Content Cutover

The highest-risk phase. The public site changes for the first time.

| Group | Work | Reference |
|---|---|---|
| Pages CMS | `pages`; section registry; section editor | [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.6, [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §5.9 |
| Section components | 10 renderers; `SectionRenderer` | [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) §6 |
| Data layer | React Query, `api/client.js`, hooks; `ContactForm` on `useSubmitLead` | [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) §7 |
| Content migration | Page copy → `pages`; footer/contact → `settings` | [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §8 (M3, M4) |
| **Prerendering** | Static prerender at build; publish webhook | [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §2 |
| SEO | `Seo` component; CMS-driven metadata; `sitemap.xml`; JSON-LD; redirects; 404 | [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §3, §5, §7 |
| Product detail | `/products/:slug` — **design approval required** | [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) §0 |

### Hard ordering requirement

**Prerendering ships before content moves to the CMS.** Not after, not alongside.

Today page copy is inside the JS bundle. Moving it to an API call without prerendering means content arrives one network round-trip *later* than it does now — a measurable SEO and LCP regression on a site whose stated first rule is SEO. Prerendering first makes the cutover neutral-to-positive instead.

### Migration approach

Page by page, not all at once. For each: build its sections → seed its CMS document → switch the page to `usePage()` → verify visually at all five breakpoints → ship. Eight independent, individually revertable changes rather than one cutover.

**Recommended order:** Sustainability → About → Quality → Why DEF → Packaging → Products → Contact → Home. Lowest-traffic and structurally simplest first; Home last because it carries the hero and the most inbound traffic; Contact second-to-last because it holds the live form.

### Risks

| Risk | Mitigation |
|---|---|
| Visual regression during section extraction | Per-page verification at 320/640/768/1024/1280 against the current build before each ship |
| Contact form breaks silently | Ship behind the legacy alias; monitor submission volume daily for a week after the Contact page migrates; alert on zero submissions in 24h |
| Content lost in migration | Migration scripts are idempotent and additive; original JSX retained in git until sign-off |
| CMS down → blank site | Prerendered HTML is static and survives an API outage. `Navbar`/`Footer` keep static fallbacks |

**Gate:** all 8 pages render from the CMS and are pixel-identical to the pre-migration build · prerendered HTML contains real content with per-route metadata · `sitemap.xml` lists all published URLs · lead submissions continue uninterrupted through the cutover.

---

## 6. Phase 4 — Frontend Modernisation

Pure maintainability, performance, and responsiveness. Zero visual change. Deliberately last: it is the phase with the highest ratio of visual-regression risk to business value, so it runs when nothing else depends on it.

| Group | Work | Reference |
|---|---|---|
| Build | CRA → Vite | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Structure | 5-layer component tree; ESLint boundary rules | [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) §2–3 |
| Styling | `App.css` → CSS Modules, declarations moved verbatim | [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) §8 |
| Responsive | 9 `max-width` queries → `min-width` on the canonical scale; remove 2 `!important`; unify 1300/1400px container | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) § Responsive Strategy |
| Accessibility | Real form labels; mobile menu focus trap + `aria-expanded`; focus rings | [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) §4.3, §4.4 |
| Performance | Self-hosted Poppins; WebP hero + `srcset`; lazy-loading; route code-splitting; Lighthouse CI | [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §6 |

**Gate:** every page pixel-identical at all five breakpoints · no `!important` in layout CSS · Lighthouse mobile Performance ≥ 90, SEO ≥ 95, Accessibility ≥ 90 · no cross-layer import violations.

---

## 7. Phase 5 — Growth

Per [PROJECT_BIBLE.md](PROJECT_BIBLE.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) Phase 4: blogs, downloads, dealer network, case studies, careers.

Not specified further here. Each needs its own data model, and specifying them now would be guessing at requirements that six months of real lead data should inform. The section renderer and CMS foundation are designed so each is additive.

---

## 8. Dependency Graph

```
Phase 0  Stabilise
   │
   ├──────────────► 0.7–0.9 SEO quick wins ──┐  (independent, ship anytime)
   │                                          │
Phase 1  Backend foundation                   │
   │  layering → TypeScript → auth → leads    │
   │                                          │
Phase 2  CMS core                             │
   │  media ──► catalogue                     │
   │  leads (parallel) ──► dashboard          │
   │                                          │
Phase 3  Content cutover                      │
   │  PRERENDER ──► section components ──► page-by-page migration
   │                                     └──► SEO metadata + sitemap + JSON-LD
   │
Phase 4  Frontend modernisation
   │  Vite ──► CSS Modules ──► responsive rewrite
   │           accessibility + performance (parallel)
   │
Phase 5  Growth
```

**Parallelisable:** SEO quick wins (0.7–0.9) with any phase · leads with catalogue in Phase 2 · accessibility and performance with styling in Phase 4.

**Strictly sequential:** layering before auth · media before catalogue · prerendering before content cutover · Phase 3 before Phase 4.

---

## 9. Decisions Blocking Progress

| # | Decision | Blocks | Status |
|---|---|---|---|
| 1 | Product vs. packaging variant model | Phase 2 catalogue | **Resolved** — Option B, provisionally. [SEED_DATA.md](SEED_DATA.md) §1 |
| 2 | Real specification values from the CoA | Product **publish**, not build | **Unblocked** — placeholders seeded and gated. [SEED_DATA.md](SEED_DATA.md) §3 |
| 6 | Real company address, phone, email | Local SEO, `LocalBusiness` schema | **Unblocked** — placeholders carried forward. [SEED_DATA.md](SEED_DATA.md) §2 |
| 3 | Rendering strategy | Phase 3 | Open. Recommendation: static prerendering — [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §2 |
| 4 | `/packaging` — distinct copy, or canonicalise to `/products`? | Phase 3 | Open. Distinct copy if maintainable; otherwise canonicalise |
| 5 | Design approval for `/products/:slug` | Phase 3 | Open. Compose from approved components only |
| 7 | Lead data retention period | Phase 1 | Open. None set; confirm compliance requirement |
| 8 | Number of admin users | Phase 2 | Open. Determines whether the 4-role matrix is warranted |

Decisions 1, 2, and 6 no longer block **building** — placeholder values in [SEED_DATA.md](SEED_DATA.md) unblock every phase up to publication. They now block **launch** instead, which moves them off the critical path but does not remove them from it.

The launch gate in [SEED_DATA.md](SEED_DATA.md) is enforced in code: a product whose specifications still carry `isPlaceholder: true` fails the publish check. Items 1–3 on that file's replacement checklist share one source (lab/QA) and should be requested together; the Certificate of Analysis has the longest external turnaround.

---

## 10. Definition of Done Per Phase

Applies to every phase without exception:

1. Gate criteria met and demonstrated, not asserted.
2. No visual change to any existing page, verified at 320/640/768/1024/1280.
3. Contact form submits successfully end-to-end.
4. No new item on the [CLAUDE_RULES.md](CLAUDE_RULES.md) violation list — no hardcoded content, no duplicated code, no controller logic.
5. Security checks for that phase's surface pass ([SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §12).
6. Documentation updated where the implementation diverged from the plan. A doc describing something that was not built is worse than no doc.
