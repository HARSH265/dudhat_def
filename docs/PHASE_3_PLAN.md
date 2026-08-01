# Phase 3 Plan — Content Cutover

> Execution plan. Strategy already exists and is **not restated here**:
> rendering and SEO in [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md), sections and
> collections in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.6,
> frontend structure in [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md),
> phase sequencing in [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) §5.
>
> This document says **what to build, in what order, and what will go wrong**.

---

## 1. Objectives

1. The eight public pages render from the CMS instead of hardcoded JSX.
2. The site is **prerendered**, so crawlers and social scrapers receive real HTML.
3. Per-route SEO metadata, `sitemap.xml`, structured data and redirects exist.
4. `/products/:slug` exists — the catalogue currently has no destination.
5. **The contact form never stops working.**

**Non-objective:** redesign. The public design is frozen. Every page must be pixel-identical after migration.

---

## 2. The Sequencing Constraint

**Prerendering ships before any content moves to the CMS. Not alongside, not after.**

Today, page copy is inside the JS bundle. Moving it to an API call *without* prerendering puts it behind an extra network round-trip — content arrives strictly later than it does now. On a project whose first stated rule is "SEO First", that is a regression introduced by the work meant to improve things.

Prerendering first makes the cutover neutral-to-positive. This is the single most important decision in the phase.

---

## 3. SEO Strategy

Detail in [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md). What Phase 3 must deliver:

| Item | Note |
|---|---|
| Per-route `<title>` and meta description | Resolved from `SeoMeta` with a read-time fallback chain, so renaming a product updates its meta title without a migration |
| Canonical, OG, Twitter tags | One `Seo` component; no page assembles head tags itself |
| `sitemap.xml` | Generated from published pages, products and categories. `<loc>` + `<lastmod>` only — Google ignores `priority` and `changefreq` |
| JSON-LD | `Organization` + `WebSite` sitewide; `Product` on detail pages; `BreadcrumbList` below root. **`LocalBusiness` only once the address is real** |
| `robots.txt` | Exists. Gains the sitemap line |
| Real 404 | Unknown routes currently return **HTTP 200** with an empty body — a soft-404 that dilutes crawl budget |
| Redirects | `redirects` collection. Unblocks the currently-frozen published-slug rule |

**Blocked on business input:** `LocalBusiness` needs a real address; product structured data needs real specification values. Neither blocks the build, both block publication.

---

## 4. Prerender Strategy

**Static prerendering at build time**, Vite plugin, with webhook-triggered rebuilds. Rationale in [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §2 — chosen over SSR because ~12 low-churn routes do not justify a stateful render tier, and over Next.js because that is a full framework migration against a frozen design.

**Freshness:** publishing fires a build webhook. Time-to-live for a content change is one build, roughly 1–3 minutes. The admin panel should say so rather than implying instant publication.

**What stays dynamic:** lead submission is a runtime `POST`, unaffected. The admin app is excluded entirely — `noindex`, behind auth, never prerendered.

**Ordering within this step:** CRA → Vite must land first, because the prerender plugin is a Vite plugin. That is a build-config change with no component changes, and it is the riskiest infrastructure move in the phase — do it on its own, verify all eight pages, then add prerendering.

---

## 5. CMS Integration Strategy

**Backend**
1. `pages` collection with the embedded `Section` array ([DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.6).
2. Per-type section validators in a registry — `data` is `Mixed`, so the registry *is* the schema. An unknown `type` is 422, never stored.
3. Public read endpoints: `GET /pages/:key`, `/products`, `/products/:slug`, `/categories`, `/settings`, `/navigation`.
4. Admin section editor endpoints.
5. `redirects` collection, and lift the published-slug freeze.

**Frontend**
6. `api/client.js`, React Query provider, query keys.
7. Ten section renderers + `SectionRenderer`.
8. `Seo` component.
9. Pages become thin: fetch + compose.

**Admin**
10. Page list and section editor.

### The four duplicated patterns collapse here

`About`/`Sustainability` → one `TextImageSection`. `Products`/`Packaging` → one `ProductGridSection` with different filters. `Quality`/`WhyDef` → one `CtaBannerSection`. Seven near-duplicate page files become eight thin pages plus ten reusable sections — the "no duplicated code" rule finally satisfied.

---

## 6. Content Migration Plan

Migration M3 in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §8, plus assets.

**Page by page, not all at once.** For each: build its sections → seed its CMS document → switch the page to `usePage()` → verify at all five breakpoints → ship. Eight independent, individually revertable changes.

**Order — lowest risk first:**

| # | Page | Why here |
|---|---|---|
| 1 | Sustainability | Lowest traffic, simplest structure, no form |
| 2 | About | Same `textImage` pattern — proves reuse immediately |
| 3 | Quality | Adds `checklist` and `ctaBanner` |
| 4 | Why DEF | Adds `processFlow` |
| 5 | Packaging | Adds `productGrid`, which fetches its own data |
| 6 | Products | Same section, different filter |
| 7 | Contact | **Holds the live form.** Second to last, deliberately |
| 8 | Home | Hero, most inbound traffic, highest cost if wrong |

**Assets:** the 13 local PNGs upload to Cloudinary and become `media` documents. Keep `client/src/assets/images` until the CMS is verified, then remove. Image optimisation (WebP, `srcset`) happens at this point since the files are being touched anyway.

**Settings:** `npm run seed:settings` already exists and carries placeholders forward verbatim. `Navbar` and `Footer` switch to `useSettings()` with the current hardcoded arrays as a static fallback — a marketing site showing nothing when the CMS is down is worse than one showing slightly stale links.

---

## 7. Public Site Integration Plan

**The contact form is the one thing that must not break.** It is the site's only conversion path and it fails *silently* — no error surfaces, leads simply stop.

Rules for step 7 above:
- Ships behind the permanent legacy alias, so rollback is a client-side revert with no server change.
- Response `message` strings stay byte-identical.
- **Monitor submission volume daily for a week** after the Contact page migrates. Alert on zero submissions in 24h.
- `useSubmitLead` uses `retry: 0` — a retried POST creates duplicate leads.

**Also in this phase, from earlier deferrals:**
- Fix the six dead footer links (needs real URLs — currently blocked on business input).
- Wire `ProductCard`'s inert button to `/products/:slug`.
- `/products/:slug` is a **new page** and needs design approval before build; compose it only from approved components.

---

## 8. Risks and Mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Content moves before prerendering — SEO and LCP regression | **High** | Hard ordering. Prerender is step 1 |
| 2 | Contact form breaks silently — lost leads | **High** | Legacy alias; byte-identical messages; daily volume monitoring for a week; zero-submission alert |
| 3 | Visual regression during section extraction | **High** | Per-page check at 320/640/768/1024/1280 against the pre-migration build, before each ship |
| 4 | CRA → Vite breaks the build | Medium | Separate step, no component changes, verify all eight pages before proceeding |
| 5 | Content lost in migration | Medium | Idempotent additive scripts; original JSX retained in git until sign-off |
| 6 | CMS down → blank site | Medium | Prerendered HTML is static and survives an API outage. `Navbar`/`Footer` keep static fallbacks |
| 7 | Slug change breaks inbound links | Medium | `redirects` collection ships in this phase; until then the freeze stands |
| 8 | Placeholder content published | Medium | Product publish gate exists. **Settings has no gate — add one** |
| 9 | `/packaging` and `/products` cannibalise each other | Low | Distinct copy, or canonicalise. Decision still open |

Risk 8 is worth acting on: the publish gate blocks placeholder *products*, but nothing stops placeholder company details reaching the public site, and Phase 3 is where those start rendering.

---

## 9. Recommended Implementation Order

**3A — Infrastructure** (no content change)
1. CRA → Vite; verify all eight pages unchanged
2. Prerendering + build webhook
3. `api/client.js`, React Query, `Seo` component, real 404

**3B — Backend** (no public change)
4. `pages` collection + section registry + validators
5. Public read endpoints
6. `redirects` collection; lift the slug freeze

**3C — Sections** (no content change)
7. Ten section renderers + `SectionRenderer`, built against fixtures

**3D — Cutover** (public changes begin)
8. Seed settings; `Navbar`/`Footer` onto `useSettings()` with fallback
9. Pages 1–6 in the order above
10. Contact page — then monitor
11. Home page
12. Assets to Cloudinary; image optimisation

**3E — SEO completion**
13. `sitemap.xml`, JSON-LD, redirect handling
14. `/products/:slug` (design approval first)
15. Lighthouse CI and budgets

**Gate:** all eight pages render from the CMS and are pixel-identical to the pre-migration build · prerendered HTML contains real content with per-route metadata · `sitemap.xml` lists every published URL · lead submissions uninterrupted throughout.

---

## 10. Before Starting

See [PHASE_3_READINESS_REPORT.md](PHASE_3_READINESS_REPORT.md). Two items are genuine prerequisites rather than nice-to-haves: **prerendering sign-off**, and **at least the §8 security tests from [TESTING_STRATEGY.md](TESTING_STRATEGY.md)** — Phase 3 touches the live conversion path, which is the worst place to discover a silently-failing regression.
