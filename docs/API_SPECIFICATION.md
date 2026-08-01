# API Specification

> Status: Planning document. No code written yet.
> Scope: Target REST API for Dudhat DEF V2.
> Related: [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md), [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md), [ARCHITECTURE.md](ARCHITECTURE.md), [CLAUDE_RULES.md](CLAUDE_RULES.md)

---

## 1. Current State

Two endpoints exist.

| Method | Path | Handler | Auth | Notes |
|---|---|---|---|---|
| `POST` | `/api/contact` | `contactController.submitContact` | none | Creates a `Contact` |
| `GET` | `/api/contact` | `contactController.getContacts` | **none** | Returns every contact submission |
| `GET` | `/` | inline | none | Liveness string |

### Problems to fix

1. **`GET /api/contact` is unauthenticated and returns all lead data.** Every name, email, phone, and company that has ever been submitted is publicly readable. This is the highest-severity issue in the codebase and is fixed by moving the endpoint under `/api/v1/admin/leads` behind JWT auth.
2. **`cors()` with no options** allows every origin. Must be restricted to `CLIENT_URL` and `ADMIN_URL`.
3. **No rate limiting.** The public contact endpoint can be flooded.
4. **No validation layer.** `contactController` hand-checks four fields with `if (!name || ...)`, then passes `req.body` values into `Contact.create`. No format checks, no length caps, no sanitisation.
5. **Business logic in the controller**, contradicting [ARCHITECTURE.md](ARCHITECTURE.md). There is no service or repository layer.
6. **No versioning.** Paths are `/api/*` with no version segment.
7. **No central error handler.** Each `catch` writes its own response; a thrown error outside a `try` crashes the request.
8. **No `helmet`, no body size limit, no request logging.**

### Contract preservation

[CLAUDE_RULES.md](CLAUDE_RULES.md) forbids breaking API contracts. The live client (`ContactForm.jsx`) posts to `${API_URL}/api/contact` and reads `res.data.message`. Therefore:

- `POST /api/contact` **remains mounted** as a permanent alias that forwards to `POST /api/v1/leads`, preserving its exact request and response shape.
- `GET /api/contact` **is removed**, not aliased. It is a data-exposure bug; no client uses it. This is the one deliberate break, and it is a security fix.

---

## 2. Conventions

### Base URL and versioning

```
Public   /api/v1/...
Admin    /api/v1/admin/...
Legacy   /api/contact          (alias, POST only)
```

Version lives in the path. A breaking change means `/api/v2`; `v1` then stays available for at least one release cycle.

### Response envelope

The existing shape is kept, because the current client already depends on it.

**Success**
```json
{
  "success": true,
  "message": "Human-readable string",
  "data": {}
}
```

**Success with a collection**
```json
{
  "success": true,
  "message": "Products fetched",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error**
```json
{
  "success": false,
  "message": "Human-readable string",
  "errorCode": "VALIDATION_ERROR",
  "errors": [
    { "field": "email", "message": "Must be a valid email address" }
  ]
}
```

`message` is always safe to display to an end user. Stack traces and driver errors never cross the boundary — they are logged server-side with a `requestId`, and the response carries that `requestId` in non-production only.

### Status codes

| Code | Used for |
|---|---|
| 200 | Successful read / update |
| 201 | Resource created |
| 204 | Successful delete with no body |
| 400 | Malformed request |
| 401 | Missing or invalid credentials |
| 403 | Authenticated but not permitted |
| 404 | Resource not found |
| 409 | Conflict — duplicate slug, blocked delete, invalid status transition |
| 413 | Payload too large |
| 422 | Validation failed |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error |
| 503 | Database unavailable / maintenance mode |

### Error codes

Machine-readable, stable, never localised.

```
VALIDATION_ERROR      INVALID_CREDENTIALS   TOKEN_EXPIRED        TOKEN_INVALID
FORBIDDEN             NOT_FOUND             DUPLICATE_SLUG       DUPLICATE_EMAIL
RESOURCE_IN_USE       INVALID_STATUS_TRANSITION                  RATE_LIMITED
FILE_TOO_LARGE        UNSUPPORTED_FILE_TYPE UPLOAD_FAILED        ACCOUNT_LOCKED
MAINTENANCE_MODE      INTERNAL_ERROR
```

### Pagination, sorting, filtering

Applies to every admin list endpoint and every public list endpoint.

| Param | Default | Notes |
|---|---|---|
| `page` | 1 | 1-indexed |
| `limit` | 20 | max 100, enforced server-side |
| `sort` | varies | `field` or `-field`; allowlisted per resource |
| `search` | — | Text index query |
| `status` | — | Filter |
| `from` / `to` | — | ISO date range on `createdAt` |

Any `sort` field not on the resource's allowlist is rejected with 400 rather than silently ignored — silent ignores hide client bugs.

### Naming

- Paths are plural nouns, kebab-case: `/api/v1/admin/lead-activities`
- Query params and JSON fields are camelCase
- Resources are addressed publicly by `slug`, in admin by `_id`

### Headers

Requests: `Content-Type: application/json`, `Authorization: Bearer <accessToken>` (admin).
Responses: `X-Request-Id` on every response; `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` on rate-limited routes.

---

## 3. Layering

Per [ARCHITECTURE.md](ARCHITECTURE.md), every request follows:

```
Route → Middleware → Validator → Controller → Service → Repository → MongoDB
```

| Layer | Responsibility | Forbidden |
|---|---|---|
| Route | Path, method, middleware wiring | Any logic |
| Middleware | Auth, RBAC, rate limit, upload, request id | Business rules |
| Validator | Shape, type, length, format of `req` | Database access |
| Controller | Read validated input, call one service, shape the response | Business rules, DB calls, `try/catch` boilerplate |
| Service | Business rules, orchestration, transactions, cross-entity checks | `req` / `res` awareness |
| Repository | Queries, projections, indexes hints | Business conditions |

Controllers are wrapped in an `asyncHandler` so no controller contains `try/catch`. Errors are thrown as typed `AppError`s and rendered by one central error middleware.

**Current violation to unwind:** `contactController.submitContact` does validation, business logic, and persistence in one function. Its logic splits into a `leadValidator`, a `leadService.createLead`, and a `leadRepository.create`.

---

## 4. Public API

No authentication. Cached, rate-limited, read-only except for lead creation.

### 4.1 Content

#### `GET /api/v1/pages/:key`

Full page content for a route. `key` ∈ `home | about | products | why-def | quality | packaging | sustainability | contact`.

Returns the page with `status: published` and its ordered, visible sections.

```json
{
  "success": true,
  "message": "Page fetched",
  "data": {
    "key": "home",
    "title": "Home",
    "slug": "/",
    "sections": [
      {
        "type": "hero",
        "order": 1,
        "data": {
          "heading": "CLEAN DIESEL.",
          "highlight": "CLEANER FUTURE.",
          "subheading": "High quality Diesel Exhaust Fluid (DEF)...",
          "backgroundImage": { "url": "...", "alt": "..." },
          "badgeImage": { "url": "...", "alt": "ISO 22241 Compliant" },
          "buttons": [
            { "text": "Our Products", "to": "/products", "variant": "primary" },
            { "text": "Contact Us", "to": "/contact", "variant": "outline" }
          ]
        }
      }
    ],
    "seo": { }
  }
}
```

`404 NOT_FOUND` if the key is unknown or the page is not published.

Cache: `public, max-age=300, stale-while-revalidate=600`.

#### `GET /api/v1/settings`

Global site settings for the shell — company info, contact details, social links, logo, feature flags. Analytics IDs are included; nothing secret is.

Cache: `public, max-age=600`.

#### `GET /api/v1/navigation`

Derived nav structure so the `Navbar` and `Footer` stop hardcoding their link arrays.

```json
{
  "data": {
    "primary": [ { "name": "Home", "path": "/" } ],
    "footer": {
      "quickLinks": [],
      "products": [],
      "whyDef": []
    }
  }
}
```

### 4.2 Catalogue

#### `GET /api/v1/categories`

Published categories, ordered by `displayOrder`. Query: `parent` (slug, optional).

#### `GET /api/v1/categories/:slug`

One category with its published products.

#### `GET /api/v1/products`

| Param | Notes |
|---|---|
| `category` | Category slug |
| `featured` | `true` — homepage strip |
| `search` | Text search |
| `page` / `limit` / `sort` | `sort` allowlist: `displayOrder`, `-createdAt`, `name`, `-name` |

Returns a **list projection** — `name`, `slug`, `shortDescription`, `primaryImage`, `badges`, `categoryName`, `packaging[].label`. Not the full specification array; product listings render four cards and should not ship every spec row.

#### `GET /api/v1/products/:slug`

Full product: description, `specifications`, `applications`, `packaging`, `gallery`, `brochure`, `seo`, plus `relatedProducts` (up to 4 from the same category).

Side effect: enqueues a `pageviews` record and a buffered `viewCount` increment. This is fire-and-forget — analytics failure must never fail the read.

`404 NOT_FOUND` if unpublished.

#### `GET /api/v1/products/:slug/brochure`

`302` redirect to the signed Cloudinary URL for the brochure PDF, after recording a `brochure`-type download event. Returns `404` if the product has no brochure.

### 4.3 Lead capture

#### `POST /api/v1/leads`

The conversion endpoint. Every CTA in [PROJECT_BIBLE.md](PROJECT_BIBLE.md) — Request Quote, Contact Us, Call Now, WhatsApp Inquiry — funnels here with a different `type`.

**Request**

```json
{
  "name": "Ramesh Patel",
  "email": "ramesh@example.com",
  "phone": "+919876543210",
  "company": "Patel Transport",
  "message": "Need monthly supply of 210L drums.",
  "type": "quote",
  "productSlug": "def-210l-drum",
  "quantity": "20 drums / month",
  "city": "Rajkot",
  "sourcePage": "/products",
  "utm": { "source": "google", "medium": "cpc", "campaign": "def-q3" },
  "website": ""
}
```

| Field | Required | Validation |
|---|---|---|
| `name` | yes | 2–100 chars, letters/spaces/`.`/`-`/`'` |
| `email` | yes | RFC-valid, lowercased, ≤ 254 chars, MX-checked async |
| `phone` | yes | 8–15 digits, normalised to E.164, default region IN |
| `company` | no | ≤ 150 chars |
| `message` | yes | 10–2000 chars, HTML stripped |
| `type` | no | enum; default `contact` |
| `productSlug` | no | Must resolve to a published product |
| `quantity` | no | ≤ 100 chars |
| `city` / `state` | no | ≤ 100 chars |
| `sourcePage` | no | Path only, ≤ 200 chars |
| `utm.*` | no | ≤ 100 chars each, alphanumeric + `-_` |
| `website` | — | **Honeypot.** Must be empty. Non-empty → accept with `200` and discard, flagged `isSpam`. |

**Response `201`**

```json
{
  "success": true,
  "message": "Thank you! Your message has been sent successfully.",
  "data": { "leadNumber": "DEF-2026-00042" }
}
```

The `message` string is byte-identical to what `contactController` returns today, so the existing `ContactForm` continues to display the same confirmation.

**The response never echoes the stored lead.** The current implementation returns `data: newContact` — the whole document. That leaks `_id` and internal fields to an anonymous caller for no benefit.

**Service-layer behaviour on create:** normalise phone → compute spam score → persist lead → write a `leadactivities` `created` record → `$inc` the product's `inquiryCount` → enqueue an admin notification email → enqueue an acknowledgement email to the submitter. Steps after persistence run out-of-band; an SMTP outage must not turn a captured lead into a 500.

**Rate limits:** 5 per IP per hour, 3 per email per hour, 20 per IP per day. Exceeding returns `429 RATE_LIMITED` with a `Retry-After` header.

#### `POST /api/v1/leads/callback`

Minimal form — `name` + `phone` only. Creates a lead with `type: callback`. Same rate limits.

### 4.4 SEO

| Method | Path | Notes |
|---|---|---|
| `GET` | `/sitemap.xml` | Generated from published pages, products, categories. Cached 1h. |
| `GET` | `/robots.txt` | From settings; disallows `/admin` and `/api`. |
| `GET` | `/api/v1/seo/redirects` | Active redirect map, for the edge/host layer. Cached 5m. |

### 4.5 System

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/health` | `{ status, uptime, db: 'connected' \| 'disconnected' }`. `503` when the DB is down. |
| `GET` | `/` | Kept as-is: `"Dudhat DEF API is running..."`. Harmless and already referenced. |

---

## 5. Admin API

All routes under `/api/v1/admin` require a valid access token. Role gates come from the matrix in [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §4.

### 5.1 Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/admin/auth/login` | none | Email + password → access token in body, refresh token in HttpOnly cookie |
| `POST` | `/api/v1/admin/auth/refresh` | cookie | Rotates the refresh token, returns a new access token |
| `POST` | `/api/v1/admin/auth/logout` | required | Revokes the current refresh token |
| `POST` | `/api/v1/admin/auth/logout-all` | required | Revokes every refresh token for the user |
| `GET` | `/api/v1/admin/auth/me` | required | Current user + role + permissions |
| `POST` | `/api/v1/admin/auth/forgot-password` | none | Always `200`, regardless of whether the email exists |
| `POST` | `/api/v1/admin/auth/reset-password` | none | Token + new password; revokes all sessions |
| `PATCH` | `/api/v1/admin/auth/change-password` | required | Current + new password. **Implemented** — see below |
| `GET` | `/api/v1/admin/auth/sessions` | required | Active sessions, current one flagged |
| `DELETE` | `/api/v1/admin/auth/sessions/:id` | required | Revoke one of your own sessions |

**Token design**

| Token | Lifetime | Transport | Contents |
|---|---|---|---|
| Access | 15 min | `Authorization: Bearer`, held in memory client-side | `sub`, `role`, `iat`, `exp` |
| Refresh | 7 days | HttpOnly, Secure, SameSite=Strict cookie, path-scoped to `/api/v1/admin/auth` | Opaque random string; only its SHA-256 hash is stored |

Refresh tokens rotate on every use. Reuse of a already-rotated token revokes the entire chain for that user and logs a `login_failed` audit event — that pattern means a stolen token.

Access tokens are never written to `localStorage`. Login throttling: 5 failures per email per 15 min, then `423`-equivalent `ACCOUNT_LOCKED` for 30 minutes.

**Revocation reasons.** Every refresh token records *why* it was revoked: `rotated`, `logout`, `password_change`, `admin_action`, `reuse_detected`. This is load-bearing — reuse detection fires only on `rotated`, because an administratively revoked token being presented is a signed-out device, not a stolen one. Treating the two alike revokes sessions that were deliberately preserved. See [PHASE_2E_SECURITY_REVIEW.md](PHASE_2E_SECURITY_REVIEW.md) §3.

#### `PATCH /admin/auth/change-password`

```json
{ "currentPassword": "…", "newPassword": "…" }
```

Throttled at the login rate — accepting the current password makes it an oracle for guessing it.

Returns a **new access token and rotates the refresh cookie**, so the calling device stays signed in while every other session is revoked. Response shape matches `login`.

Rejections: `400` for a wrong current password, a new password identical to the current one, or any policy failure. Policy is enforced in `utils/passwordPolicy`, not in the schema, so change-password, reset-password and admin user creation cannot drift apart.

#### `GET /admin/auth/sessions`

```json
{ "data": [
  { "id": "…", "userAgent": "…", "createdAt": "…", "expiresAt": "…", "isCurrent": true }
] }
```

`ipHash` is deliberately **not** returned — a salted hash means nothing to the user and only widens what a stolen response reveals.

#### `DELETE /admin/auth/sessions/:id`

Scoped to the caller's own sessions **in the query**, so an unknown or foreign id returns `404` rather than revealing existence. Revoking your own current session returns `400` with a pointer to sign-out.

### 5.2 Dashboard

#### `GET /api/v1/admin/dashboard`

Backs the four widgets named in [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md).

```json
{
  "data": {
    "totalLeads": 412,
    "newLeads": 17,
    "quoteRequests": 63,
    "productViews": 8940,
    "trends": {
      "leadsThisMonth": 48,
      "leadsLastMonth": 39,
      "changePercent": 23.1
    },
    "leadsByStatus": { "new": 17, "contacted": 22, "qualified": 9, "quotation_sent": 5, "won": 3, "lost": 12 },
    "leadsBySource": { "website": 380, "phone": 20, "referral": 12 },
    "topProducts": [ { "slug": "def-210l-drum", "name": "210L Drum", "views": 3200, "inquiries": 28 } ],
    "recentLeads": [],
    "leadsOverTime": [ { "date": "2026-07-01", "count": 4 } ]
  }
}
```

Query: `from`, `to` (default: last 30 days). Served from the daily rollup, not raw `pageviews`.

### 5.3 Leads

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/admin/leads` | admin, editor, sales | List + filter + search |
| `GET` | `/admin/leads/:id` | admin, editor, sales | Detail + activity timeline |
| `PATCH` | `/admin/leads/:id` | admin, sales | Update status, priority, assignee, value |
| `POST` | `/admin/leads/:id/notes` | admin, sales | Append a note activity |
| `POST` | `/admin/leads/:id/assign` | admin | Assign to a user |
| `POST` | `/admin/leads` | admin, sales | Manually create (phone/walk-in lead) |
| `POST` | `/admin/leads/:id/spam` | admin | Mark / unmark spam |
| `DELETE` | `/admin/leads/:id` | superadmin | Soft delete only |
| `GET` | `/admin/leads/export` | admin | CSV / XLSX export |

**List filters:** `status`, `type`, `source`, `assignedTo`, `productId`, `priority`, `isSpam`, `from`, `to`, `search`, `page`, `limit`, `sort`.

**`PATCH` status rules.** The transition is validated against the state machine in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.7. An illegal move returns `409 INVALID_STATUS_TRANSITION` naming the allowed targets. Moving to `lost` requires `lostReason`. Every change writes a `leadactivities` record — the timeline is not optional bookkeeping, it is how the sales handover works.

**Export** is audit-logged with the row count and filter set, and is rate-limited to 5/hour. Bulk lead export is the most sensitive operation in the panel.

### 5.4 Products

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/admin/products` | all | List, including drafts |
| `GET` | `/admin/products/:id` | all | Full document |
| `POST` | `/admin/products` | admin, editor | Create |
| `PUT` | `/admin/products/:id` | admin, editor | Full update |
| `PATCH` | `/admin/products/:id/status` | admin, editor | Publish / unpublish / archive |
| `PATCH` | `/admin/products/reorder` | admin, editor | Bulk `displayOrder` update |
| `DELETE` | `/admin/products/:id` | admin | Soft delete |
| `POST` | `/admin/products/:id/duplicate` | admin, editor | Clone as draft |

**Create/update validation:** `name` required; `slug` auto-generated from `name` if omitted, uniqueness-checked, returns `409 DUPLICATE_SLUG` on collision; `categoryId` must reference a non-deleted category; every `mediaId` must resolve; `description` is sanitised against an HTML allowlist; `specifications[]` validated per [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §4.

**Publish rules (implemented in Phase 2C).** Publishing requires `primaryImage`, `shortDescription`, at least one specification, and at least one available packaging variant. A `422` lists **every** blocker at once rather than the first — a dialog revealing one problem at a time makes the editor guess how many remain.

The gate additionally refuses:
- any specification with `isPlaceholder: true` — these are published ISO limits, not this product's measured results, and shipping them as results misstates the product to buyers who purchase on specification;
- any `[PLACEHOLDER]` marker in `badges`, `tagline` or `shortDescription` — a badge reading `[PLACEHOLDER] ISO 22241` asserts a certification with no evidence behind it.

**Slug changes on a published product currently return `409`.** The redirect-on-change behaviour described in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §9 needs the `redirects` collection, which is Phase 3; until then the change is refused rather than silently breaking inbound links. Unpublish first to rename.

### 5.5 Categories

| Method | Path | Role |
|---|---|---|
| `GET` | `/admin/categories` | all |
| `GET` | `/admin/categories/:id` | all |
| `POST` | `/admin/categories` | admin, editor |
| `PUT` | `/admin/categories/:id` | admin, editor |
| `PATCH` | `/admin/categories/reorder` | admin, editor |
| `DELETE` | `/admin/categories/:id` | admin |

Delete returns `409 RESOURCE_IN_USE` with the blocking product list when published products reference the category.

### 5.6 Pages

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/admin/pages` | all | All eight pages with status |
| `GET` | `/admin/pages/:key` | all | Page with sections |
| `PUT` | `/admin/pages/:key` | admin, editor | Replace sections array |
| `PATCH` | `/admin/pages/:key/sections/:sectionId` | admin, editor | Update one section |
| `PATCH` | `/admin/pages/:key/sections/reorder` | admin, editor | Reorder |
| `PATCH` | `/admin/pages/:key/status` | admin | Publish / unpublish |
| `GET` | `/admin/pages/:key/preview` | all | Draft render token |

Each section's `data` is validated against the registry entry for its `type` before write. An unknown `type` is `422`, never stored.

### 5.7 Media

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/admin/media` | all | Browse: `folder`, `fileType`, `tags`, `search`, pagination |
| `GET` | `/admin/media/:id` | all | Detail + usage list |
| `POST` | `/admin/media/upload` | admin, editor | `multipart/form-data`, up to 10 files |
| `PUT` | `/admin/media/:id` | admin, editor | Update `alt`, `caption`, `tags`, `folder` |
| `POST` | `/admin/media/:id/replace` | admin, editor | Swap the binary, keep the `_id` |
| `DELETE` | `/admin/media/:id` | admin | Soft delete; `409` if in use |
| `GET` | `/admin/media/:id/usage` | all | Documents referencing this media |

**Upload constraints**

| Rule | Value |
|---|---|
| Max image size | 5 MB |
| Max document size | 20 MB |
| Allowed images | `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml` |
| Allowed documents | `application/pdf` |
| Type detection | Magic bytes, not extension or client-supplied MIME |
| SVG handling | Sanitised (scripts/handlers stripped) before storage |
| Filenames | Regenerated server-side; the client-supplied name is stored as a display label only |
| Duplicate detection | SHA-256 checksum → returns the existing document with `wasDuplicate: true` |

Files are streamed to Cloudinary. Nothing is written to the API server's disk — no temp directory to fill and no path-traversal surface.

### 5.8 SEO

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/admin/seo/overview` | admin, editor | Every page/product with SEO completeness score and warnings |
| `PATCH` | `/admin/seo/:entityType/:id` | admin, editor | Update the embedded `seo` sub-document |
| `GET` | `/admin/seo/redirects` | admin | List |
| `POST` | `/admin/seo/redirects` | admin | Create |
| `DELETE` | `/admin/seo/redirects/:id` | admin | Delete |
| `POST` | `/admin/seo/sitemap/regenerate` | admin | Force cache bust |

Overview warnings: missing meta title, meta title > 60 chars, missing meta description, description outside 120–160 chars, missing OG image, duplicate meta title across documents, `noIndex` set on a published page.

### 5.9 Settings & Users

| Method | Path | Role |
|---|---|---|
| `GET` | `/admin/settings` | all |
| `PUT` | `/admin/settings` | admin |
| `GET` | `/admin/users` | superadmin, admin |
| `POST` | `/admin/users` | superadmin |
| `PUT` | `/admin/users/:id` | superadmin |
| `PATCH` | `/admin/users/:id/status` | superadmin |
| `DELETE` | `/admin/users/:id` | superadmin |
| `GET` | `/admin/activity-logs` | superadmin, admin |

User creation sends an invite with a set-password link; an admin never types another user's password. Deactivating a user revokes all their refresh tokens immediately.

---

## 6. Middleware Stack

Order matters; this is the intended pipeline.

```
1.  requestId              — attach X-Request-Id
2.  helmet                 — security headers
3.  cors                   — origin allowlist: CLIENT_URL, ADMIN_URL
4.  express.json           — limit '100kb'
5.  express.urlencoded     — limit '100kb', extended: false
6.  mongoSanitize          — strip $ and . from keys
7.  hpp                    — HTTP parameter pollution
8.  compression
9.  morgan / pino-http     — structured request logging
10. globalRateLimit        — 300 req / 15 min / IP
11. maintenanceGuard       — 503 when settings.maintenanceMode and path is public
12. router
13. notFoundHandler        — 404 envelope
14. errorHandler           — single exit point for all errors
```

Route-level, layered on top:

| Middleware | Applied to |
|---|---|
| `authenticate` | all `/admin/*` except `auth/login`, `auth/refresh`, `auth/forgot-password`, `auth/reset-password` |
| `authorize(...roles)` | per-route, per the matrix |
| `validate(schema)` | every route with a body or params |
| `strictRateLimit` | `POST /leads`, `POST /leads/callback`, `auth/login`, `auth/forgot-password` |
| `upload` | media routes |

**CORS specifics:** `credentials: true` (the refresh cookie requires it), explicit `origin` allowlist — never `origin: true` with credentials, which is equivalent to allowing all origins.

---

## 7. Caching

| Layer | What | TTL |
|---|---|---|
| HTTP `Cache-Control` | Public GETs | 300s pages/products, 600s settings/navigation |
| ETag | All public GETs | Conditional `304` |
| In-process | `settings` singleton | 5 min, invalidated on write |
| In-process | Published product list | 5 min, invalidated on product write |
| Client (React Query) | See [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) §7 | staleTime 5 min |

Admin responses are always `Cache-Control: no-store`. Stale lead data in a sales workflow is worse than a round-trip.

---

## 8. Security Requirements

| Requirement | Mechanism |
|---|---|
| No public access to lead data | `GET /api/contact` removed; leads live under authenticated admin routes |
| Origin restriction | CORS allowlist |
| Injection defence | `mongoSanitize` + `mongoose.set('sanitizeFilter', true)` + validators |
| XSS in rich text | Allowlist sanitisation on write and escaping on render |
| Brute force | Login throttle + account lockout |
| Token theft | Short access TTL, rotating refresh, reuse detection, HttpOnly cookie |
| Spam | Honeypot + rate limits + spam scoring |
| Enumeration | `forgot-password` and `login` return identical timing and messages for unknown vs known emails |
| Payload abuse | 100 KB body limit, 5/20 MB upload limits |
| Secrets | Environment only; `.env` never committed; rotate the currently-committed one |
| Transport | HTTPS enforced; HSTS via helmet |
| Audit | Every admin mutation writes an `activitylogs` record |

**Explicitly out of scope for v1:** API keys for third parties, OAuth/SSO, 2FA. 2FA for `superadmin` is a Phase 3 candidate.

---

## 9. Legacy Compatibility

`POST /api/contact` stays mounted permanently and maps as follows:

| Legacy field | New field |
|---|---|
| `name` | `name` |
| `email` | `email` |
| `phone` | `phone` |
| `company` | `company` |
| `message` | `message` |
| — | `type: 'contact'`, `source: 'website'` |

Legacy response, unchanged in shape:

```json
{
  "success": true,
  "message": "Thank you! Your message has been sent successfully.",
  "data": { }
}
```

`data` becomes `{ "leadNumber": "..." }` rather than the full document. `ContactForm.jsx` reads only `res.data.message`, so this is invisible to the current client while closing the over-disclosure.

Error responses keep the current strings: 400 → `"Please fill all required fields (name, email, phone, message)"`, 500 → `"Something went wrong. Please try again later."`

---

## 10. Endpoint Index

**Public — 14**

```
GET    /api/v1/health
GET    /api/v1/pages/:key
GET    /api/v1/settings
GET    /api/v1/navigation
GET    /api/v1/categories
GET    /api/v1/categories/:slug
GET    /api/v1/products
GET    /api/v1/products/:slug
GET    /api/v1/products/:slug/brochure
POST   /api/v1/leads
POST   /api/v1/leads/callback
GET    /api/v1/seo/redirects
GET    /sitemap.xml
GET    /robots.txt
```

**Admin — 47**

```
Auth       8    POST login, refresh, logout, logout-all, forgot-password,
                reset-password · GET me · PATCH change-password
Dashboard  1    GET dashboard
Leads      9    GET list, detail, export · POST create, notes, assign, spam
                PATCH update · DELETE
Products   8    GET list, detail · POST create, duplicate · PUT update
                PATCH status, reorder · DELETE
Categories 6    GET list, detail · POST · PUT · PATCH reorder · DELETE
Pages      7    GET list, detail, preview · PUT · PATCH section, reorder, status
Media      7    GET list, detail, usage · POST upload, replace · PUT · DELETE
SEO        6    GET overview, redirects · PATCH entity · POST redirect,
                sitemap/regenerate · DELETE redirect
Settings   2    GET · PUT
Users      5    GET list · POST · PUT · PATCH status · DELETE
Audit      1    GET activity-logs
```

**Legacy — 1**: `POST /api/contact`

---

## 11. Build Order

| Phase | Deliverable |
|---|---|
| 1 | Middleware stack, error handler, validators, service/repository layering, auth endpoints, legacy alias, **removal of `GET /api/contact`** |
| 2 | Products, categories, media, leads, dashboard |
| 3 | Pages/sections, SEO, redirects, sitemap, analytics |
| 4 | Blogs, downloads, dealer network |

Phase 1's removal of `GET /api/contact` should not wait for the rest of Phase 1 — it is a one-line change that closes a live data exposure and can ship immediately.
