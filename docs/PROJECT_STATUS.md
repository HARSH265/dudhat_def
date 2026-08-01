# Project Status

> **The living status document. Update it at the end of every phase.**
> Everything volatile about the project lives here; other documents describe
> design and do not track state.
>
> `PHASE_*_HANDOVER.md` files are frozen snapshots. When they disagree with
> this file, **this file is right**.

**Last updated:** end of Phase 2F
**Current phase:** between 2F and 3 — nothing in progress
**Last completed phase:** 2F (CMS admin UI + S1 rich-text sanitisation)

---

## 1. Where the Project Stands

The **back office is functional**. The **public site is not yet CMS-driven** — all eight pages still have content hardcoded in JSX. The CMS exists and nothing consumes it.

That gap is Phase 3 and is the single largest remaining piece of work.

| Layer | State |
|---|---|
| `server/` | TypeScript, layered, authenticated, 10 collections, ~50 endpoints |
| `admin/` | Working panel: leads, media, catalogue, SEO, profile |
| `client/` | Untouched except defect fixes. Content hardcoded. No React Query, no prerendering |

---

## 2. Current Capabilities

**An admin can:** sign in · change password · view and revoke sessions · see dashboard KPIs · work leads end to end (list, filter, search, detail, timeline, notes, assign, status transitions, spam, CSV export, pipeline board) · upload and manage media · create and publish categories · create and edit products with rich text, specifications and SEO metadata · manage users and roles.

**An admin cannot yet:** edit packaging variants in the UI · manage settings or read the activity log in the UI · edit public page content (no `pages` collection) · reorder, duplicate or delete products from the UI · replace media from the UI.

**A public visitor gets:** the same hardcoded site as before, plus Phase 0 fixes (robots.txt, `h1` per page, image dimensions, security headers, rate limiting). Contact form works and writes to `leads`.

---

## 3. Open Work

| # | Item | Size | Notes |
|---|---|---|---|
| 1 | **Phase 3 — content cutover** | Large | Prerendering **must** precede it |
| 2 | Packaging variant editor UI | Medium | Data model complete; UI only |
| 3 | Settings screen, Users screen, activity log | Medium | Endpoints exist |
| 4 | Gallery/brochure pickers, media replace, product reorder/duplicate/delete UI | Small each | Endpoints exist |
| 5 | `TESTING_STRATEGY.md` implementation | Medium | Document now written; no tests exist |
| 6 | `GET /media/:id/usage` | Small | Count and guard work; itemised list does not |
| 7 | Public catalogue endpoints | Medium | Ship with Phase 3 |
| 8 | `GET /api/v1/health` | Trivial | Documented, never built |

---

## 4. Open Decisions

| # | Decision | Blocks | Owner |
|---|---|---|---|
| 1 | **Prerendering sign-off** — static prerender at build, per `SEO_ARCHITECTURE.md` §2 | Phase 3 | You |
| 2 | **Logo casing** — a rename changed "DHUDHAT DEF" to "Dudhat DEF" on every page. A visible change under the design freeze, still unresolved | Nothing, but it is live | You |
| 3 | `/packaging` — distinct copy, or canonicalise to `/products`? Both render the same variants | Phase 3 | You |
| 4 | Design approval for `/products/:slug` — a new public page | Phase 3 | You |
| 5 | Lead data retention period | Compliance | You |
| 6 | Real Certificate of Analysis values | Product publication | Lab/QA |
| 7 | Real company address, phone, email | Local SEO, `LocalBusiness` schema | Business |

Decisions 6 and 7 have external turnaround and are the most likely critical path.

---

## 5. Known Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Moving content to the CMS without prerendering first is a net SEO regression** — an extra round-trip before any text exists | High | Sequencing: prerender first. Non-negotiable |
| 2 | **Placeholder data reaching production.** Specs are ISO limits, not measured results; address and phone are placeholders | High | Publish gate blocks products. **Nothing blocks settings** — this is a real hole |
| 3 | **No tests, no CI, no dependency scanning** | High | `TESTING_STRATEGY.md` now exists; nothing implemented |
| 4 | Seed password not yet rotated | Medium | UI exists at `/admin/profile`. Owner action |
| 5 | Contact form fails silently if broken — no error surfaces, leads just stop | Medium | Legacy alias permanent; monitor submission volume after any change |
| 6 | Mongoose `sanitizeFilter` trap | Medium | `MONGOOSE_GOTCHAS.md` + audit command. Has caused five bugs |
| 7 | `react-router-dom` unpatched advisory — RSC-mode only, unreachable in an SPA | Low | Monitor; do not adopt RSC or framework-mode routers |
| 8 | 6 dead footer links point to `/` | Low | Phase 3, needs real URLs |

---

## 6. Next Recommended Task

**Rotate the seed password**, then **write and run the first tests** from `TESTING_STRATEGY.md` §9 — specifically the consequence-based security checks — then **start Phase 3 with prerendering**.

Rationale for that order: the password is a two-minute owner action that is currently the key to content reaching the public site. Tests come next because three shipped bugs so far returned a plausible response while doing nothing, and only consequence-testing caught them — Phase 3 touches the live conversion path, which is the worst place to discover that class of bug.

Phase 3 detail: `PHASE_3_PLAN.md`. Readiness assessment: `PHASE_3_READINESS_REPORT.md`.

---

## 7. Test Data — Do Not Delete Without Approval

Four seeded leads, still the **only** regression coverage for lead workflows:

`DEF-2026-00001` new · `DEF-2026-00002` lost · `DEF-2026-00003` won · `DEF-2026-00004` quotation_sent

Keep until `TESTING_STRATEGY.md` is implemented and these paths have real tests.

---

## 8. Phase History

| Phase | Delivered |
|---|---|
| 0 | Closed a live lead-PII leak, git init, security headers, CORS allowlist, rate limiting, SEO basics, 742KB of dead assets removed |
| 1A–1D | TypeScript, layering, auth + RBAC + audit, leads/settings/counters |
| 1 review | 3 high / 6 medium / 11 low; high and medium fixed |
| 2A | Lead management API, dashboard, user administration |
| 2B | Media API on Cloudinary |
| 2C | Categories, products, publish gate, media usage integration |
| 2D | Admin app scaffold, auth flow, shell |
| 2E | Lead list, detail, pipeline board, per-user rate limits |
| 2E security | Change-password, sessions, revocation reasons |
| 2F | CMS admin UI, Tiptap, S1 sanitisation |
