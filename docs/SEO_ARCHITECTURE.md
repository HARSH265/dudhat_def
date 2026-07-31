# SEO Architecture

> Status: Planning document. No code written yet.
> Scope: Rendering strategy, metadata pipeline, URL structure, and Core Web Vitals for the public site.
> Complements [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §7 (structured data properties) and [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §4.1 (`SeoMeta` fields). Neither is repeated here.

---

## 1. Current State

[CLAUDE_RULES.md](CLAUDE_RULES.md) states "SEO First". The implementation does not currently support it.

| Element | State | Evidence |
|---|---|---|
| Rendering | Client-side only | CRA SPA; `client/public/index.html` ships an empty `<div id="root">` |
| Per-route `<title>` | None | One static title for all 8 routes, `index.html:9` |
| Per-route meta description | None | One static description, `index.html:6` |
| Head management library | None | `client/package.json` has no helmet/head package |
| Canonical tags | None | — |
| Open Graph / Twitter Card | None | — |
| Structured data (JSON-LD) | None | — |
| `robots.txt` | **Missing** | `client/public/` contains only `index.html` |
| `sitemap.xml` | **Missing** | — |
| Favicon | **Missing** | — |
| `manifest.json` | **Missing** | — |
| Heading hierarchy | Inconsistent | `Home.jsx` has `h1`; `Products.jsx`, `Packaging.jsx`, `WhyDef.jsx` start at `h2` with no `h1` |
| Image alt text | Present | Genuinely good — every `<img>` in the codebase has a meaningful `alt` |
| Semantic HTML | Partial | `header`, `footer`, `nav`, `section` used correctly |
| Image format | PNG only | 13 unoptimised PNGs, no WebP/AVIF, no responsive `srcset` |
| Image dimensions | Not set | No `width`/`height` attributes — CLS risk |
| Font loading | Render-blocking | Google Fonts `<link>` in `<head>`, no `font-display` |
| Internal linking | Weak | Footer "Products" list is plain `<li>` text, not links; Privacy/Terms link to `/` |
| 404 handling | None | Unknown routes render the shell with an empty body and return HTTP 200 |
| URL structure | Clean | 8 readable, lowercase, hyphenated routes — no changes needed |

### The core problem

Every page returns the same HTML: one title, one description, no content. A crawler that does not execute JavaScript sees eight identical, empty pages. Google does render JavaScript, but it does so in a deferred second pass with no guaranteed timing, and other crawlers — Bing, LinkedIn, WhatsApp, Slack — largely do not.

The last one matters commercially. Per [PROJECT_BIBLE.md](PROJECT_BIBLE.md), WhatsApp inquiry is a primary conversion action. A link to this site shared on WhatsApp today renders a preview with the generic homepage title and no image, regardless of which page was shared.

**Moving content to the CMS makes this worse, not better.** Today the copy is at least inside the JS bundle. After the CMS migration, content arrives via an API call *after* the bundle executes — an extra network round-trip before any text exists in the DOM. Adopting the CMS without also fixing rendering would be a net SEO regression.

---

## 2. Rendering Strategy — The Missing Decision

Not specified in any existing document, including [ARCHITECTURE.md](ARCHITECTURE.md). It governs whether the SEO-first goal is achievable, and it constrains the frontend build, so it must be decided before Phase 3.

### Options

| Option | How | Fit |
|---|---|---|
| **A — CSR (status quo)** | SPA, content fetched client-side | Rejected. Fails social crawlers outright; defers Google indexing; regresses under the CMS |
| **B — Prerender at build** | Vite + `vite-plugin-ssr` / `react-snap`; crawl routes at build, emit static HTML | Strong fit. Real HTML per route, CDN-cacheable, no server runtime. Requires a rebuild when content changes |
| **C — SSR** | Express renders React per request | Works, but adds a stateful render tier, cache invalidation, and hydration mismatch bugs. Disproportionate for ~12 low-churn pages |
| **D — Prerender middleware** | Serve cached HTML to detected bots only | Rejected. Cloaking risk, a bot-list to maintain, and it fixes nothing for real users' LCP |
| **E — Next.js** | Migrate to a framework with ISR | Best long-term. But it is a full framework migration touching every file, against a frozen design and a live site |

### Decision: **Option B — static prerendering at build time, with webhook-triggered rebuilds**

Rationale specific to this project:

1. **Content volume is small and churn is low.** Eight pages, one product line, four packaging variants — roughly 12 routes. A full rebuild takes under a minute.
2. **It composes with the frozen design.** Prerendering changes the build, not a single component. Option E does not.
3. **It composes with the CMS.** The build fetches from the same `/api/v1/pages/:key` and `/api/v1/products` endpoints the client would call. No duplicate data path.
4. **Best possible Core Web Vitals.** Static HTML from a CDN, no API round-trip before first paint. This is also the cheapest LCP win available.
5. **No new runtime attack surface**, unlike Option C.

**Freshness mechanism:** publishing content in the admin panel fires a build webhook. Time-to-live for a content change is one build cycle, roughly 1–3 minutes. That is acceptable for marketing copy and product specifications, and the panel states it plainly rather than implying instant publication.

**What stays dynamic.** Prerendering applies to content only. Lead form submission is a client-side `POST` at runtime, unaffected. The admin panel is a separate SPA and is deliberately excluded — it is `noindex` and behind auth.

**Escape hatch:** if content volume grows past a few hundred routes, or near-instant publishing becomes a requirement, Option E is the migration target. Option B does not block it — a prerendered Vite app and a Next.js app share the same component tree and the same API.

> **Needs sign-off before Phase 3.** Prerendering must be in place *before* content moves to the CMS, not after, or the site ships a period of degraded indexing.

---

## 3. Metadata Pipeline

### Source of truth

Every route's metadata resolves from the `SeoMeta` sub-document ([DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §4.1) on its `pages` or `products` record. The fallback chain runs at read time, so metadata is never stale relative to the content it describes:

```
metaTitle       → seo.metaTitle → `${document.title} | ${settings.company.brandName}` 
metaDescription → seo.metaDescription → shortDescription → first 160 chars of body
ogImage         → seo.ogImage → primaryImage → settings.ogDefaultImage
canonical       → seo.canonicalUrl → self
```

### Rendering

A single `common/Seo.jsx` component ([COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) §2) takes a resolved `seo` object and emits every tag. One component, one contract — no page assembles head tags itself.

Emitted per route:

| Tag | Notes |
|---|---|
| `<title>` | ≤ 60 chars |
| `<meta name="description">` | 120–160 chars |
| `<link rel="canonical">` | Absolute, self-referencing by default |
| `<meta name="robots">` | From `noIndex`/`noFollow` |
| `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:site_name` | `og:image` ≥ 1200×630 |
| `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` | |
| `<html lang="en-IN">` | Currently `en` |
| JSON-LD | Per §5 |

### Title conventions

| Route type | Pattern |
|---|---|
| Home | `Dudhat DEF \| Driving Cleaner Tomorrow` (unchanged — currently correct) |
| Content page | `{Page Title} \| Dudhat DEF` |
| Product | `{Product Name} \| ISO 22241 DEF Supplier \| Dudhat DEF` |
| Category | `{Category} \| Dudhat DEF` |

The brand suffix is appended by the `Seo` component, not stored in `metaTitle`. Storing it would consume characters in the admin panel's counter and make a brand rename a content migration.

### Admin surface

The SEO Manager ([ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §5.11) already specifies the editor, SERP preview, and the completeness warnings. No duplication here.

---

## 4. URL & Routing

The current 8 URLs are clean, readable, lowercase, and hyphenated. **They do not change.** Every one is a potential existing inbound link or index entry, and changing them for tidiness costs authority for no gain.

### Target map

| URL | Source | Status |
|---|---|---|
| `/` | `pages.home` | Existing |
| `/about` | `pages.about` | Existing |
| `/products` | `pages.products` + product list | Existing |
| `/why-def` | `pages.why-def` | Existing |
| `/quality` | `pages.quality` | Existing |
| `/packaging` | `pages.packaging` | Existing |
| `/sustainability` | `pages.sustainability` | Existing |
| `/contact` | `pages.contact` | Existing |
| `/products/:slug` | `products` | **New** — see §4.1 |
| `/404` | — | **New** |

### Rules

- Lowercase, hyphenated, no trailing slash, no file extensions, no query parameters for canonical content
- Maximum depth 2 (`/products/Dudhat-def`)
- Slugs are immutable after publish; a change creates a 301 via the `redirects` collection ([DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.10)
- Unknown routes return **HTTP 404** with a real 404 page. Currently they return 200 with an empty body, which is a soft-404 — Google treats these as low-quality pages and it dilutes crawl budget

### 4.1 The `/products` and `/packaging` duplicate-content risk

Under the recommended model in [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §3, both pages render the same four packaging variants. Today they already show the same four titles with different images.

Two near-identical pages compete for the same queries and split their own authority. Resolution:

- `/products` targets the product and its specifications — purity, ISO 22241, urea concentration, applications
- `/packaging` targets container and logistics queries — drum sizes, IBC tank, MOQ, pallet quantities, storage and handling
- Each carries a distinct `metaTitle`, `metaDescription`, and body copy
- Each canonicalises to itself; neither canonicalises to the other
- `/products/:slug` is the detail page both link into, and it is the canonical target for product-specification queries

If the business will not maintain genuinely distinct copy for both, the correct move is to canonicalise `/packaging` to `/products` and keep it as a navigational page. That is a content decision, and it needs an answer before Phase 3 — the alternative is two thin pages cannibalising each other.

---

## 5. Structured Data

JSON-LD only. Property-to-field mapping for `Product` is in [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §7 and is not repeated.

| Schema type | Where | Source |
|---|---|---|
| `Organization` | Site-wide, homepage | `settings` — legal name, logo, contact, social profiles, address |
| `WebSite` | Homepage | Site name + URL |
| `Product` | `/products/:slug` | Per [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §7 |
| `BreadcrumbList` | All pages below root | Route hierarchy |
| `LocalBusiness` | `/contact` | `settings.address` + geo, once the placeholder address is real |
| `FAQPage` | Where a page has genuine Q&A | Not currently applicable |

Two constraints worth stating because they are commonly violated:

- **`offers` is omitted** on `Product`. There is no public pricing, and emitting a zero or placeholder price to silence a validator warning is a false statement about the product.
- **`LocalBusiness` waits for a real address.** `Footer.jsx` and `Contact.jsx` currently contain `Plot No. ___, MIDC, ________, Maharashtra`. Emitting structured data built on placeholders is worse than emitting none — it publishes a machine-readable claim that the business address is unknown.

Every emitted block is validated against the Rich Results Test before its phase ships.

---

## 6. Performance & Core Web Vitals

SEO-relevant only. Targets are the "good" thresholds, measured on mobile at the 75th percentile.

| Metric | Target | Current risk |
|---|---|---|
| LCP | < 2.5s | High — CSR, unoptimised PNG hero, render-blocking font |
| INP | < 200ms | Low — little interactivity |
| CLS | < 0.1 | High — no image dimensions, web font swap |
| TTFB | < 800ms | Resolved by prerendering + CDN |

### Actions, in order of impact

1. **Prerender (§2).** The single largest LCP win — HTML arrives with content instead of an empty root div.
2. **Hero image.** `hero-bg.png` is the LCP element on `/`. Convert to WebP with a PNG fallback, serve responsive `srcset` at 640/1024/1920, `fetchpriority="high"`, and never lazy-load it.
3. **Set `width`/`height` on every `<img>`.** 13 images currently have none. This is the main CLS source and the cheapest fix in this list.
4. **Self-host Poppins.** Removes two external origins (`fonts.googleapis.com`, `fonts.gstatic.com`), removes a DNS + TLS round-trip from the critical path, allows `font-display: swap`, and tightens the CSP in [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §9. Subset to Latin, and ship only the 5 weights actually used (400/500/600/700/800).
5. **Lazy-load below-fold images** with `loading="lazy"` — everything except the hero.
6. **Route-level code splitting** via `React.lazy` on the 8 page components.
7. **CRA → Vite.** Smaller bundles, better tree-shaking, modern output targets.
8. **Cloudinary transformations** for CMS-uploaded media: `f_auto,q_auto` plus width variants, so editors cannot accidentally publish a 4MB product photo.

Items 2, 3, and 5 change no visual output and can ship immediately, independent of everything else in this document.

**Budgets**, enforced in CI once a pipeline exists: JS ≤ 200KB gzipped initial, CSS ≤ 50KB, LCP image ≤ 200KB, Lighthouse mobile Performance ≥ 90, SEO ≥ 95, Accessibility ≥ 90.

---

## 7. Crawlability

### `robots.txt` — currently missing

Generated from `settings`, served at the root:

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Sitemap: https://<domain>/sitemap.xml
```

**Staging must serve `Disallow: /`.** An indexed staging environment competes with production for the same queries — a common and expensive mistake.

### `sitemap.xml` — currently missing

Generated from published `pages`, `products`, and `categories` per [API_SPECIFICATION.md](API_SPECIFICATION.md) §4.4. Includes `<loc>` and `<lastmod>` from `updatedAt`. Omits `<priority>` and `<changefreq>` — Google ignores both, and populating them is busywork that implies precision the data does not have.

Only `status: published`, non-`noIndex` URLs are listed. Regenerated on publish, cached 1 hour.

### Other

- **404**: real HTTP 404 status, branded page, links back to Home / Products / Contact
- **Redirects**: `redirects` collection, 301 by default, chains collapsed on write
- **Internal linking gaps to fix in `Footer.jsx`**: the "Products" column is plain `<li>` text and should link to product pages; "Why DEF" items should link to `/why-def`; Privacy Policy and Terms currently link to `/`, which are two dead internal links on every page of the site
- **Pagination**: not needed at current catalogue size

---

## 8. Content & Semantics

### Heading hierarchy — currently broken

`Products.jsx`, `Packaging.jsx`, and `WhyDef.jsx` open with `<h2 className="section-title">` and have no `<h1>`. Every page needs exactly one `<h1>`.

The fix is a **CSS-only change with no visual effect**: change the element from `h2` to `h1` and move the existing `.section-title` styling to match. The rendered appearance is identical; only the semantic level changes. This falls inside the design freeze as a defect fix.

### Keyword targets

Derived from the actual product and the buyer types in [PROJECT_BIBLE.md](PROJECT_BIBLE.md), not invented:

| Page | Primary intent |
|---|---|
| `/` | DEF manufacturer / supplier India |
| `/products` | Diesel Exhaust Fluid 10L / 20L / 210L / 1000L |
| `/packaging` | DEF drum, IBC tank, bulk DEF packaging |
| `/why-def` | What is DEF, SCR system, NOx reduction |
| `/quality` | ISO 22241 DEF, DEF purity standards |
| `/sustainability` | Emission reduction, eco-friendly DEF |
| `/contact` | DEF supplier contact, DEF dealer enquiry |
| `/products/:slug` | DEF specifications, urea 32.5% |

`/why-def` and `/quality` carry the strongest informational-search potential and are the natural seeds for the blog planned in Phase 4.

### Geographic targeting

The business is Indian and B2B, so location signals matter for procurement searches: `<html lang="en-IN">`, `LocalBusiness` schema with real coordinates once the address is confirmed, city and state named in `/contact` copy, and NAP (name, address, phone) consistent between the site, the schema, and any Google Business Profile.

**Blocked on real data.** The address, phone (`+91 12345 67890`), and email in `Footer.jsx` and `Contact.jsx` are all placeholders. Local SEO cannot start until they are real, and inconsistent NAP across sources actively harms local ranking.

---

## 9. Measurement

| Tool | Purpose | Phase |
|---|---|---|
| Google Search Console | Indexing, queries, Core Web Vitals field data | Phase 0 — verify the domain immediately; it only collects data from verification onward |
| GA4 | Traffic, conversions | Phase 1, via `settings.analytics.gaMeasurementId` |
| Lighthouse CI | Budget enforcement | Phase 3 |
| Bing Webmaster Tools | Secondary index | Phase 3 |

**Conversion events** — the metrics [PROJECT_BIBLE.md](PROJECT_BIBLE.md) names as success criteria:

`lead_submit` (with `type` and `product`) · `quote_request` · `brochure_download` · `phone_click` · `whatsapp_click` · `product_view`

Analytics loads deferred, after first paint, and never blocks rendering or the contact form. Consent handling is not modelled — the site sets no marketing cookies today, and if GA4 is added for EU visitors that becomes a legal question to answer before launch rather than an architectural one.

---

## 10. Build Order

| Phase | SEO work |
|---|---|
| **0** | Verify Search Console. Add `robots.txt`, favicon. Fix the three footer dead links. Add `width`/`height` to all images. Fix heading hierarchy |
| **1** | `Seo` component + per-route metadata from static content. Real 404 route. Self-host Poppins. Hero image optimisation, lazy-loading |
| **2** | Metadata driven from CMS `SeoMeta`. `sitemap.xml`. `Organization` + `WebSite` JSON-LD. Redirect handling |
| **3** | **Prerendering (§2) — before content cutover, not after.** `Product` + `BreadcrumbList` JSON-LD. Lighthouse CI. `/products/:slug` |
| **4** | `LocalBusiness` once the address is real. Blog. Bing |

Phase 0 is a few hours, changes nothing visually, and includes the one item with a hard time dependency: Search Console collects no historical data before verification, so every week it is delayed is a week of baseline permanently lost.
