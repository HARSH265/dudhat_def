# Admin Panel Specification

> Status: Planning document. No code written yet.
> Scope: The CMS / lead-management back office for Dudhat DEF V2.
> Related: [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md), [API_SPECIFICATION.md](API_SPECIFICATION.md), [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)

---

## 1. Current State

**There is no admin panel.** The only administrative capability that exists is `GET /api/contact`, which returns every contact submission as raw JSON to any anonymous caller. That endpoint is removed in Phase 1 (see [API_SPECIFICATION.md](API_SPECIFICATION.md) §1) and replaced by everything in this document.

The panel expands [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md) — Dashboard, Pages, Products, Media, Leads, SEO — into concrete screens, fields, states, and permissions.

---

## 2. Placement Decision

**Recommendation: a separate application at `/admin`, built with Vite + React, deployed as its own bundle.**

| Option | Verdict |
|---|---|
| Routes inside the existing CRA public site | Rejected — ships the entire CMS bundle to every anonymous visitor, harming the Core Web Vitals that the SEO-first goal depends on |
| Separate Vite + React SPA under `/admin` | **Chosen** — independent bundle, independent deploy, no weight on the public site, and it lets the panel adopt the [ARCHITECTURE.md](ARCHITECTURE.md) target stack (Vite, React Query, Tailwind, shadcn/ui) without first migrating the public site off CRA |
| Off-the-shelf CMS (Strapi, Payload) | Rejected — the lead pipeline is the core product, and bending a generic CMS's admin around a sales workflow costs more than building it |

Repository layout:

```
client/    public marketing site (CRA today, Vite later)
admin/     admin SPA (Vite + React + React Query + Tailwind + shadcn/ui)
server/    shared API
```

The admin app consumes only `/api/v1/admin/*`. It shares no runtime code with `client/`; anything genuinely common (types, validation schemas) moves to a `shared/` package rather than being imported across apps.

**Design language:** the panel is a tool, not a brochure. It reuses the brand colours from `client/src/styles/variables.css` (`--color-navy #0a2a5e` as primary, `--color-green #2e9e4f` for success/positive) and Poppins, but it does not inherit the marketing site's spacing, hero patterns, or animation. Density beats drama in an admin table.

---

## 3. Information Architecture

```
/admin/login
/admin/forgot-password
/admin/reset-password/:token

/admin                              Dashboard
/admin/leads                        Lead list
/admin/leads/board                  Pipeline (kanban)
/admin/leads/:id                    Lead detail
/admin/products                     Product list
/admin/products/new
/admin/products/:id                 Product editor
/admin/categories                   Category list + editor
/admin/pages                        Page list
/admin/pages/:key                   Section editor
/admin/media                        Media library
/admin/seo                          SEO overview
/admin/seo/redirects                Redirect manager
/admin/settings                     Site settings
/admin/users                        User management
/admin/activity                     Audit log
/admin/profile                      Own account
```

**Sidebar** (fixed, collapsible, role-filtered):

```
Dashboard
Leads              ← badge: count of status = new
Catalogue
  ├ Products
  └ Categories
Content
  ├ Pages
  └ Media Library
SEO
  ├ Overview
  └ Redirects
Settings
Users              ← superadmin / admin only
Activity Log       ← superadmin / admin only
```

**Topbar:** breadcrumb · global search (⌘K) · new-lead notification bell · user menu (Profile, Change Password, Logout).

---

## 4. Roles & Permissions

Four roles, matching the `users.role` enum in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.1.

| Role | Purpose |
|---|---|
| `superadmin` | Owner. Full access including users, audit log, and lead deletion. |
| `admin` | Day-to-day manager. Everything except user management and hard deletes. |
| `editor` | Content only. Products, pages, media, SEO. Cannot see leads. |
| `sales` | Leads only. Cannot touch content. |

### Permission matrix

`—` none · `R` read · `W` create/update · `D` delete · `P` publish

| Module | superadmin | admin | editor | sales |
|---|---|---|---|---|
| Dashboard | R | R | R (content metrics only) | R (lead metrics only) |
| Leads — list/detail | R | R | — | R |
| Leads — update status/notes | W | W | — | W |
| Leads — assign | W | W | — | — |
| Leads — export | W | W | — | — |
| Leads — delete | D | — | — | — |
| Products | RWDP | RWDP | RWP | — |
| Categories | RWDP | RWDP | RWP | — |
| Pages | RWP | RWP | RW | — |
| Pages — publish | P | P | — | — |
| Media | RWD | RWD | RW | — |
| SEO | RW | RW | RW | — |
| Redirects | RWD | RWD | — | — |
| Settings | RW | RW | R | — |
| Users | RWD | R | — | — |
| Activity Log | R | R | — | — |

**Two deliberate separations.** `editor` cannot see leads — content contributors have no reason to hold customer contact data, and narrowing that surface is the cheapest privacy control available. `sales` cannot publish content — a sales user editing the live product page is a category error.

**Enforcement:** the sidebar and buttons hide unavailable actions, but that is presentation only. Every route is enforced server-side by `authorize(...roles)`. A hidden button is not a permission.

---

## 5. Screens

### 5.1 Login — `/admin/login`

Centred card on the navy brand background. Email, password, "Remember me" (extends refresh TTL 7d → 30d), "Forgot password?".

States: idle · submitting (button disabled, spinner) · error · locked.

Error copy is deliberately uniform: `"Invalid email or password."` for both unknown email and wrong password — no account enumeration. After 5 failures: `"Too many attempts. Try again in 30 minutes."`

The access token lives in memory only. A page refresh silently calls `/auth/refresh` against the HttpOnly cookie; failure routes to login.

### 5.2 Dashboard — `/admin`

Answers "how is lead generation performing" in one screen. The four KPI cards are exactly those named in [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md).

**KPI row**

| Card | Value | Sub-line |
|---|---|---|
| Total Leads | all-time count | ▲/▼ % vs previous period |
| New Leads | `status = new` | "Needs attention" — links to filtered list |
| Quote Requests | `type = quote` | conversion % of total |
| Product Views | period sum | top product name |

**Below**

- **Leads over time** — line chart, daily buckets, range selector (7d / 30d / 90d / custom)
- **Pipeline funnel** — horizontal bars per status, each clicking through to the filtered lead list
- **Top products** — table: product · views · inquiries · view→inquiry rate
- **Lead sources** — donut over `source` + `utm.source`
- **Recent leads** — last 10, with inline status chips and a one-click "Mark contacted"
- **Content health** — counts of draft pages, unpublished products, media without alt text, pages with missing SEO; each a link to the fix

Default range: last 30 days. Role-scoped: `editor` sees only content health; `sales` sees only lead widgets.

### 5.3 Lead List — `/admin/leads`

The most-used screen in the panel. Optimised for triage speed.

**Filter bar:** search (name/company/email/phone/message) · status · type · source · assigned-to · product · priority · date range · spam toggle. Filters serialise to the URL so a view can be bookmarked and shared.

**Saved views** (tabs): All · New · My Leads · Unassigned · This Week · Quote Requests · Won · Spam.

**Table columns**

| Column | Notes |
|---|---|
| ☐ | Bulk select |
| Lead # | `DEF-2026-00042` |
| Name | Bold; company beneath |
| Contact | Email + phone, each with a click-to-copy and a `tel:`/`mailto:` action |
| Product | Chip, or "General inquiry" |
| Type | Icon + label |
| Status | Coloured chip, inline-editable |
| Assigned | Avatar, or "Unassigned" |
| Received | Relative ("2h ago"), absolute on hover |
| ⋯ | View · Assign · Mark contacted · Mark spam |

**Bulk actions:** assign, change status, mark spam, export selection.

**Row states:** unread leads (`status = new`, never opened) render with a left accent bar in `--color-green`; spam rows are muted; leads older than 48h still in `new` show an amber "ageing" dot. Response time is the single biggest lever on lead conversion, so the UI makes staleness visible rather than burying it in a report.

**Empty state:** "No leads yet. Submissions from the website will appear here." — with a link to the live contact page.

### 5.4 Pipeline Board — `/admin/leads/board`

Kanban across the six statuses from [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md): New → Contacted → Qualified → Quotation Sent → Won → Lost.

Cards show name, company, product, value, assignee avatar, age. Drag between columns issues a `PATCH` and writes a `leadactivities` record. Dropping into **Lost** opens a required-reason modal. Illegal transitions (rejected by the state machine) snap back with a toast explaining the allowed moves.

Columns show count and summed `estimatedValue`. Board is capped at 200 cards per column with "load more" — an unbounded board is unusable and expensive.

### 5.5 Lead Detail — `/admin/leads/:id`

Two columns.

**Left — the lead**
Header: lead number, status chip, priority, received timestamp, source badge.
Contact block: name, company, email, phone, city/state — each copyable, with `tel:`, `mailto:`, and WhatsApp deep links.
Inquiry block: message (full, unstyled), product (linked to the public page), quantity.
Attribution block (collapsed): source page, UTM parameters, referrer, user agent. No raw IP is shown — it is stored hashed.

**Right — the work**
Status selector (state-machine constrained) · assignee · priority · estimated value · a "Log activity" composer (note / call / email / quotation sent) · the activity timeline, newest first, each entry showing actor, action, and timestamp.

**Quick actions:** Call · Email · WhatsApp · Mark Contacted · Convert to Won.

The timeline is append-only and un-editable. It is the audit record of a commercial conversation; letting users rewrite it destroys its value.

### 5.6 Product List — `/admin/products`

Card/table toggle. Columns: image · name · category · SKU · status chip · featured star · views · inquiries · order · updated · actions.

Drag-to-reorder in table mode issues a batched `PATCH /admin/products/reorder`. Filters: category, status, featured. Bulk: publish, unpublish, archive, category reassignment.

Row actions: Edit · Duplicate · Preview (opens the public page, draft-token if unpublished) · Archive.

### 5.7 Product Editor — `/admin/products/:id`

Tabbed, with a sticky header carrying: product name, status chip, Save Draft, Publish, Preview, and an unsaved-changes indicator.

| Tab | Contents |
|---|---|
| **Basic** | Name · slug (auto from name, editable until published, then lock + redirect warning) · category · SKU · short description (counter to 300) · full description (rich text) · badges (tag input) · featured toggle · display order |
| **Specifications** | Repeatable rows — label · value · unit · group · order. Drag to reorder. "Load ISO 22241 template" prefills the standard DEF parameters from [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §4 |
| **Packaging** | Repeatable variant rows — label · volume · unit · container type · image · SKU · MOQ · units per pallet. See [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §3 |
| **Applications** | Tag list — "Trucks & Buses", "Construction Equipment", "Generators", "Agricultural Machinery" |
| **Media** | Primary image picker · gallery (drag-ordered) · brochure PDF picker. All open the Media Library modal |
| **SEO** | Meta title/description with live Google SERP preview and character counters · canonical · OG title/description/image with a social-card preview · schema type · noindex/nofollow |

**Publish gate.** Publishing requires primary image, short description, and ≥ 1 specification. Missing items surface as a checklist in the publish dialog, with each item linking to its tab. Half-populated product pages are worse for SEO than no page.

**Autosave:** drafts autosave every 30s and on tab switch. Published products do **not** autosave — publishing a typo mid-edit is unacceptable, so live content requires an explicit Save.

### 5.8 Category List — `/admin/categories`

Simple. Sortable list with inline expand for children (one level). Fields: name, slug, description, image, parent, order, status, SEO.

Delete is blocked when published products reference the category; the dialog lists them with links.

### 5.9 Page List & Section Editor — `/admin/pages`, `/admin/pages/:key`

List shows the eight fixed pages (Home, About, Products, Why DEF, Quality, Packaging, Sustainability, Contact) with status, section count, last edited, and SEO score. Pages cannot be created or deleted in v1 — the routes are fixed by `App.js`.

**Section editor:** left rail is the ordered section list (drag to reorder, eye icon to hide, ⋯ to duplicate/delete); centre is the form for the selected section; right is a live preview iframe of the draft page.

Section types available: `hero` · `featureStrip` · `textImage` · `checklist` · `processFlow` · `productGrid` · `ctaBanner` · `contactInfo` · `gallery` · `richText`. Each renders a form generated from its registry schema, so adding a section type on the server surfaces a working editor without a panel change.

`isVisible: false` hides a section from the public site while keeping its content — seasonal banners and CTAs get toggled far more often than they get written.

Publishing a page is `admin`+ only; `editor` can save drafts and request review.

### 5.10 Media Library — `/admin/media`

The four operations from [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md) — Upload, Replace, Delete, Search, Preview.

Grid of thumbnails with a folder rail mirroring the existing asset tree: `logo`, `products`, `packaging`, `general`, `documents`. Filters: type, folder, tags, date, "unused only", "missing alt text".

**Upload:** drag-and-drop or picker, multi-file, per-file progress, client-side dimension/size read before upload, duplicate detection by checksum (offers the existing file instead of re-uploading).

**Detail drawer:** preview · filename · dimensions · size · type · uploaded by/when · alt text (required before a file can be attached to published content) · caption · tags · folder · **usage list** showing every document that references it · Replace · Download · Delete.

**Replace** keeps the same `_id`, so every reference updates at once. The dialog states plainly how many places will change.

**Delete** is blocked while `usageCount > 0` and shows what is blocking it.

**Picker modal:** the same library, embedded, used by every image field in the panel. Single or multi-select, with an Upload tab so a user never has to leave a form to add a file.

### 5.11 SEO Overview — `/admin/seo`

One table of every published page, product, and category:

| URL | Type | Meta title (len) | Meta description (len) | OG image | Schema | Score | Issues |

Score is a 0–100 completeness figure, not a ranking prediction, and the UI labels it as such. Issues flagged: missing/over-length meta title, missing/short/long meta description, missing OG image, duplicate meta title, `noIndex` on a published URL, missing alt text on the primary image.

Editing opens the same SEO panel used in the product/page editors — one component, one contract.

**Redirects** (`/admin/seo/redirects`): from · to · type (301/302) · hits · active · created. Auto-created entries are badged as such. Validation rejects self-redirects and loops.

### 5.12 Settings — `/admin/settings`

Tabbed, backed by the `settings` singleton. This is what removes the hardcoded contact details currently sitting in `Footer.jsx` and `Contact.jsx`.

| Tab | Fields |
|---|---|
| Company | Legal name, brand name, tagline, about text |
| Contact | Phone, alt phone, WhatsApp, email, sales email, website |
| Address | Lines, city, state, pincode, country, map embed, lat/lng |
| Social | Facebook, LinkedIn, Instagram, YouTube, Twitter |
| Branding | Logo, favicon, default OG image |
| Analytics | GA4 measurement ID, GTM container ID, Meta Pixel ID |
| Notifications | Lead notification recipients, acknowledgement email toggle + template |
| Features | Feature flags: blog, dealer network, WhatsApp widget |
| Maintenance | Maintenance mode toggle + message — with a confirmation dialog, since it takes the public site down |

### 5.13 Users — `/admin/users`

`superadmin` only for writes. Table: name, email, role, status, last login, created. Invite flow: enter name/email/role → invite email with a set-password link → the admin never handles another user's password.

Guards: the last active `superadmin` cannot be deactivated, demoted, or deleted; a user cannot change their own role; deactivating revokes all that user's refresh tokens immediately.

### 5.14 Activity Log — `/admin/activity`

Read-only audit feed. Filters: user, entity type, action, date range. Each row expands to a field-level diff. Retained 365 days by TTL.

---

## 6. Cross-Cutting Behaviour

### Notifications

New leads matter more than anything else in the panel.

- Topbar bell with an unread count, polled every 60s (upgradeable to SSE)
- Toast on a new lead while the panel is open
- Optional browser push, per user
- Email to the recipients configured in Settings → Notifications
- Optional daily 09:00 digest

### Global search (⌘K)

One palette across leads (name, company, email, phone, lead number), products, pages, media, and navigation commands. Results grouped by type, keyboard-navigable.

### States

Every screen defines four: **loading** (skeletons, never spinners over content) · **empty** (explains what will appear and how) · **error** (what failed, with a retry) · **partial** (data present, background refetch indicated). No screen may show an infinite spinner or a bare blank.

### Confirmations

Destructive and outward-facing actions confirm first: delete anything · publish/unpublish · maintenance mode · bulk operations over 10 records · lead export. Confirming an export states the row count, because that is the panel's biggest data-egress action.

### Responsive

Desktop-first — this is a back office, and the [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) mobile-first rule targets the public site. But the mobile path is not optional: lead list, lead detail, and status updates must work on a phone, because sales staff triage leads in transit. Product and page editors are desktop-only and show an explicit "open on a larger screen" notice rather than a broken layout.

### Accessibility

Keyboard-operable throughout · visible focus rings · labelled form controls (never placeholder-as-label, which the current public `ContactForm.jsx` does) · WCAG AA contrast · `aria-live` for toasts and save states · tables with proper headers and scope.

### Session handling

Access token in memory, silent refresh on 401, one retry, then redirect to login preserving the intended path. A 5-minute idle warning before a 30-minute idle logout. Unsaved form changes prompt before navigation.

---

## 7. Build Order

| Phase | Screens |
|---|---|
| 1 | Login, app shell, Dashboard (KPIs only), Media Library, Settings |
| 2 | Lead list, Lead detail, Pipeline board, Product list, Product editor, Categories |
| 3 | Page section editor, SEO overview, Redirects, full Dashboard analytics |
| 4 | Users, Activity log, saved views, global search, notifications |

Phase 2's lead screens are the ones that make the panel worth building — the KPI cards in Phase 1 are scaffolding, and the panel does not deliver business value until a salesperson can work a lead in it.

---

## 8. Open Questions

1. **How many people will use this?** If it is one owner, the four-role matrix is over-built and `admin` + `sales` would do. The matrix is cheap to keep and expensive to retrofit, so it stays — but a "just me" answer would simplify the invite flow.
2. **Is WhatsApp integration needed beyond deep links?** A Business API integration would let the timeline capture actual conversations. Deep links are assumed for v1.
3. **Does quotation generation belong in the panel?** `quotation_sent` is a status but nothing generates a quotation. If PDF quotes are wanted, that is a Phase 3 module with its own data model.
4. **Approval workflow?** Currently `editor` saves drafts and `admin` publishes, with no formal review queue. If content review is a real process, it needs a `pending_review` status and a notification path.
