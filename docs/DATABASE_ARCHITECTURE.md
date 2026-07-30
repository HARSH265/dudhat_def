# Database Architecture

> Status: Planning document. No code written yet.
> Scope: Target MongoDB / Mongoose data layer for Dhudhat DEF V2 (CMS + Lead Generation platform).
> Related: [PROJECT_BIBLE.md](PROJECT_BIBLE.md), [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md)

---

## 1. Current State (as built)

The database layer today consists of exactly one collection.

| Item | Current value |
|---|---|
| Driver | `mongoose@^8.4.0` |
| Connection | `server/config/db.js` — single `mongoose.connect(process.env.MONGO_URI)`, `process.exit(1)` on failure |
| Collections | `contacts` only |
| Schema files | `server/models/Contact.js` |
| Indexes | None declared (only the implicit `_id`) |
| Soft delete | Not implemented |
| Audit trail | Not implemented |
| Auth / users | Does not exist |

`Contact` fields: `name` (req), `email` (req, lowercase), `phone` (req), `company`, `message` (req), `timestamps: true`.

**Everything else on the site is hardcoded in React page files.** Products, packaging, features, quality checklist, contact details, and the process flow are all JS arrays inside `client/src/pages/*.jsx`. That directly violates the "No hardcoded content" rule in [CLAUDE_RULES.md](CLAUDE_RULES.md) and is the primary problem this data layer exists to solve.

### Gap against the documented target architecture

[ARCHITECTURE.md](ARCHITECTURE.md) declares a stack that is not what is on disk. This is recorded here because the data layer plan must be explicit about which target it is built for.

| Concern | Documented target | Actually present |
|---|---|---|
| Backend language | TypeScript | JavaScript (CommonJS) |
| Layering | Controller → Service → Repository | Controller talks to Model directly |
| Media storage | Cloudinary | None |
| Frontend data | React Query | `axios` called inline in `ContactForm.jsx` |

The models below are specified language-neutrally (field name, BSON type, constraints) so they survive the JS → TS migration in Phase 1 of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) without redesign.

---

## 2. Design Principles

1. **Reference across modules, embed within a module.** A Product references its Category and Media by `ObjectId`; it embeds its own specifications and applications, because those have no life outside the product.
2. **Denormalise only display-critical fields.** Store `categoryName` alongside `categoryId` on a Product so listing endpoints avoid a populate. Denormalised copies are refreshed by the service layer on write, never trusted on read for authorisation.
3. **Every content document is publishable.** `status: draft | published | archived` plus `publishedAt`. The public API only ever reads `published`.
4. **Soft delete everywhere.** `isDeleted: Boolean` + `deletedAt` + `deletedBy`. Leads and media are never hard-deleted; content is recoverable.
5. **Every document is attributable.** `createdBy` / `updatedBy` on all admin-writable collections.
6. **Slugs are the public key.** Public URLs address content by `slug`, never by `_id`. Slugs are immutable once published; changing one creates a redirect record.
7. **SEO is a reusable embedded sub-document**, identical in shape wherever it appears (Page, Product, Category, Blog).
8. **Timestamps on everything.** `{ timestamps: true }` on every schema, without exception.

---

## 3. Collection Map

```
                          ┌───────────┐
                          │  users    │
                          └─────┬─────┘
       createdBy / updatedBy    │ (referenced by every content collection)
   ┌──────────────┬─────────────┼──────────────┬───────────────┐
   │              │             │              │               │
┌──▼───────┐ ┌────▼─────┐ ┌─────▼────┐ ┌───────▼──────┐ ┌──────▼──────┐
│ pages    │ │categories│ │ products │ │    leads     │ │  settings   │
└──┬───────┘ └────┬─────┘ └──┬───┬───┘ └───────┬──────┘ └─────────────┘
   │              │          │   │             │
   │ heroImage    │ image    │   │ gallery     │ productId (optional)
   │ sections[]   │          │   │ brochure    │
   └──────────────┴──────────┴───┘             │
                       │                       │
                 ┌─────▼─────┐          ┌──────▼───────┐
                 │   media   │          │ leadactivities│
                 └───────────┘          └──────────────┘

  Supporting: refreshtokens · redirects · activitylogs · pageviews
```

Eleven collections total. Phase mapping follows [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md):

| Phase | Collections introduced |
|---|---|
| 1 — Architecture / CMS foundation | `users`, `refreshtokens`, `settings`, `media`, `activitylogs` |
| 2 — Product CMS, Media, Leads | `categories`, `products`, `leads`, `leadactivities` |
| 3 — SEO / Analytics | `redirects`, `pageviews`, `pages` (full section CMS) |
| 4 — Growth | `blogs`, `downloads`, `dealers` (specified but not modelled here) |

---

## 4. Shared Sub-Documents

These are defined once and reused. They are embedded, never separate collections.

### 4.1 `SeoMeta`

Mirrors the SEO Manager in [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md).

| Field | Type | Constraint | Notes |
|---|---|---|---|
| `metaTitle` | String | trim, max 70 | Falls back to document `title` |
| `metaDescription` | String | trim, max 200 | Falls back to first 160 chars of body |
| `canonicalUrl` | String | trim, absolute URL | Optional; self-canonical if empty |
| `ogTitle` | String | trim, max 70 | Falls back to `metaTitle` |
| `ogDescription` | String | trim, max 200 | Falls back to `metaDescription` |
| `ogImage` | ObjectId → `media` | | Falls back to hero/primary image |
| `ogType` | String | enum: `website`, `article`, `product` | Default `website` |
| `twitterCard` | String | enum: `summary`, `summary_large_image` | Default `summary_large_image` |
| `keywords` | [String] | max 15 entries | Low SEO value; retained for internal search |
| `schemaType` | String | enum: `Organization`, `Product`, `WebPage`, `BreadcrumbList`, `FAQPage` | Drives JSON-LD emission |
| `schemaOverride` | Mixed | | Raw JSON-LD escape hatch; validated as an object |
| `noIndex` | Boolean | default `false` | Emits `robots: noindex` |
| `noFollow` | Boolean | default `false` | |

**Fallback rule:** the service layer resolves SEO at read time. Empty fields are never persisted with computed values — the fallback chain runs on every read so that renaming a product automatically updates its meta title.

### 4.2 `ImageRef`

Used wherever an image is attached. Denormalises `url` and `alt` so the read path never populates `media` for rendering.

| Field | Type | Notes |
|---|---|---|
| `mediaId` | ObjectId → `media` | Source of truth |
| `url` | String | Denormalised CDN URL |
| `alt` | String | Denormalised; per-usage override allowed |
| `width` / `height` | Number | For CLS-free rendering |

When a media document's URL changes (replace operation in the Media Library), a background job rewrites every embedded `ImageRef` with that `mediaId`.

### 4.3 `AuditFields`

Applied to every admin-writable collection.

| Field | Type | Notes |
|---|---|---|
| `createdBy` | ObjectId → `users` | Immutable |
| `updatedBy` | ObjectId → `users` | |
| `isDeleted` | Boolean | default `false`, indexed |
| `deletedAt` | Date | |
| `deletedBy` | ObjectId → `users` | |
| `createdAt` / `updatedAt` | Date | From `timestamps: true` |

**Global query rule:** all repositories apply `{ isDeleted: false }` by default. Only an explicit `includeDeleted` flag on a repository method lifts it.

---

## 5. Collection Specifications

### 5.1 `users`

Admin/CMS accounts. There is no public user registration — the site has no customer login. See [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) for the permission matrix.

| Field | Type | Constraint |
|---|---|---|
| `name` | String | required, trim |
| `email` | String | required, unique, lowercase, trim, email format |
| `passwordHash` | String | required, `select: false` |
| `role` | String | enum: `superadmin`, `admin`, `editor`, `sales`; default `editor` |
| `avatar` | ImageRef | optional |
| `phone` | String | optional |
| `isActive` | Boolean | default `true` |
| `lastLoginAt` | Date | |
| `passwordChangedAt` | Date | Invalidates tokens issued earlier |
| `failedLoginAttempts` | Number | default 0 |
| `lockedUntil` | Date | Set after N failures |
| `passwordResetTokenHash` | String | `select: false` |
| `passwordResetExpiresAt` | Date | |
| + AuditFields | | |

**Indexes**
- `{ email: 1 }` unique
- `{ role: 1, isActive: 1 }`

**Rules**
- `passwordHash` is bcrypt, cost ≥ 12. The plaintext password never enters a document, a log, or an API response.
- The schema's `toJSON` transform strips `passwordHash`, `passwordResetTokenHash`, and `__v`.
- Exactly one `superadmin` is seeded. The last active `superadmin` cannot be deactivated or demoted — enforced in the service layer, not the schema.

### 5.2 `refreshtokens`

| Field | Type | Constraint |
|---|---|---|
| `userId` | ObjectId → `users` | required, indexed |
| `tokenHash` | String | required, unique — SHA-256 of the token, never the token itself |
| `userAgent` | String | |
| `ip` | String | |
| `expiresAt` | Date | required |
| `revokedAt` | Date | |
| `replacedByTokenHash` | String | Rotation chain |

**Indexes**
- `{ tokenHash: 1 }` unique
- `{ userId: 1, revokedAt: 1 }`
- `{ expiresAt: 1 }` **TTL, `expireAfterSeconds: 0`** — MongoDB reaps expired tokens automatically

### 5.3 `categories`

Product categories per [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md). Full field semantics in [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md).

| Field | Type | Constraint |
|---|---|---|
| `name` | String | required, trim |
| `slug` | String | required, unique, lowercase, URL-safe |
| `description` | String | trim |
| `image` | ImageRef | |
| `parentId` | ObjectId → `categories` | null for root; one level of nesting supported |
| `displayOrder` | Number | default 0 |
| `status` | String | enum: `draft`, `published`, `archived`; default `draft` |
| `seo` | SeoMeta | |
| + AuditFields | | |

**Indexes**
- `{ slug: 1 }` unique (partial: `isDeleted: false`)
- `{ status: 1, displayOrder: 1 }`
- `{ parentId: 1, displayOrder: 1 }`

**Rules**
- Nesting is capped at one level (parent → child). Deeper trees are rejected by the service layer; the catalogue does not need them and unbounded recursion breaks breadcrumbs and the sitemap.
- A category with published products cannot be archived — the service returns a 409 listing the blocking products.

### 5.4 `products`

Field-by-field rationale, DEF specification model, and packaging-variant design live in [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md). Storage-level summary:

| Field | Type | Constraint |
|---|---|---|
| `name` | String | required, trim |
| `slug` | String | required, unique, lowercase |
| `sku` | String | unique sparse, uppercase |
| `categoryId` | ObjectId → `categories` | required, indexed |
| `categoryName` | String | denormalised |
| `shortDescription` | String | max 300 |
| `description` | String | rich text (sanitised HTML) |
| `specifications` | [SpecItem] | embedded array |
| `applications` | [String] | |
| `packaging` | [PackagingVariant] | embedded array |
| `primaryImage` | ImageRef | |
| `gallery` | [ImageRef] | |
| `brochure` | ObjectId → `media` | PDF |
| `badges` | [String] | e.g. `ISO 22241`, `99.9% Purity` |
| `isFeatured` | Boolean | default `false` |
| `displayOrder` | Number | default 0 |
| `status` | String | enum: `draft`, `published`, `archived` |
| `publishedAt` | Date | |
| `viewCount` | Number | default 0 |
| `inquiryCount` | Number | default 0 |
| `seo` | SeoMeta | |
| + AuditFields | | |

**Indexes**
- `{ slug: 1 }` unique (partial: `isDeleted: false`)
- `{ status: 1, displayOrder: 1 }` — primary listing index
- `{ categoryId: 1, status: 1, displayOrder: 1 }` — category listing
- `{ isFeatured: 1, status: 1 }` — homepage featured strip
- `{ name: 'text', shortDescription: 'text', 'applications': 'text' }` — admin search
- `{ sku: 1 }` unique sparse

**Counter rule:** `viewCount` and `inquiryCount` are written with `$inc` only, never read-modify-write. `viewCount` increments are batched by the analytics service (buffered in memory, flushed every 60s) so a traffic spike cannot saturate the write path.

### 5.5 `media`

Media Library backing store. [ARCHITECTURE.md](ARCHITECTURE.md) specifies Cloudinary; this schema stores provider metadata rather than binary data.

| Field | Type | Constraint |
|---|---|---|
| `filename` | String | required — sanitised original name |
| `provider` | String | enum: `cloudinary`, `local`; default `cloudinary` |
| `publicId` | String | Cloudinary public_id, indexed |
| `url` | String | required — secure CDN URL |
| `mimeType` | String | required |
| `fileType` | String | enum: `image`, `document`, `video`; derived |
| `size` | Number | bytes |
| `width` / `height` | Number | images only |
| `alt` | String | Default alt text |
| `caption` | String | |
| `tags` | [String] | Media Library search |
| `folder` | String | e.g. `products`, `packaging`, `general`, `logo` — mirrors the existing `client/src/assets/images` layout |
| `checksum` | String | SHA-256 — duplicate detection on upload |
| `usageCount` | Number | Incremented when referenced |
| + AuditFields | | |

**Indexes**
- `{ folder: 1, createdAt: -1 }` — library browsing
- `{ tags: 1 }`
- `{ checksum: 1 }` — dedupe
- `{ filename: 'text', alt: 'text', caption: 'text', tags: 'text' }` — Media Library search
- `{ publicId: 1 }` sparse

**Rules**
- Delete is soft and blocked when `usageCount > 0`; the API returns 409 with the list of referencing documents.
- Replace keeps the same `_id` and `mediaId` references intact, swaps `url`/`publicId`, and enqueues the `ImageRef` rewrite job described in §4.2.
- Uploads are validated on MIME **and** magic bytes, not on file extension.

### 5.6 `pages`

Section-driven CMS for the eight existing routes. Removes hardcoded content from `client/src/pages/*.jsx`.

| Field | Type | Constraint |
|---|---|---|
| `key` | String | required, unique, enum: `home`, `about`, `products`, `why-def`, `quality`, `packaging`, `sustainability`, `contact` |
| `title` | String | required |
| `slug` | String | required, unique |
| `sections` | [Section] | ordered, embedded |
| `status` | String | enum: `draft`, `published`, `archived` |
| `publishedAt` | Date | |
| `seo` | SeoMeta | |
| + AuditFields | | |

**`Section` sub-document**

| Field | Type | Notes |
|---|---|---|
| `type` | String | enum — see below |
| `order` | Number | Sort key within the page |
| `isVisible` | Boolean | default `true`; hide without deleting |
| `data` | Mixed | Shape determined by `type`, validated per-type by the service layer |

`type` enum, derived from the sections that exist in the current React pages:

`hero` · `featureStrip` · `textImage` · `checklist` · `processFlow` · `productGrid` · `ctaBanner` · `contactInfo` · `gallery` · `richText`

Each maps 1:1 to a renderer in [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) §6.

**Indexes**
- `{ key: 1 }` unique
- `{ slug: 1 }` unique
- `{ status: 1 }`

**Why `Mixed` for `data`:** section payloads are heterogeneous and will grow. Mongoose discriminators on an embedded array would lock the shape early and make adding a section type a migration. Validation moves to the service layer, where a per-type schema registry (one validator per `type`) enforces correctness on write. The trade-off is deliberate: no database-level guarantee on `data`, in exchange for zero-migration section evolution. Nothing reads `data` without going through the registry.

### 5.7 `leads`

The evolution of the current `contacts` collection. Fields and statuses come from [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md).

| Field | Type | Constraint |
|---|---|---|
| `leadNumber` | String | unique, generated — `DEF-2026-00001` |
| `name` | String | required, trim, max 100 |
| `email` | String | required, lowercase, trim, email format |
| `phone` | String | required, trim, E.164-normalised |
| `company` | String | trim |
| `message` | String | required, trim, max 2000 |
| `productId` | ObjectId → `products` | optional, indexed |
| `productName` | String | denormalised snapshot |
| `quantity` | String | free text — `"20 drums / month"` |
| `city` / `state` / `country` | String | country default `India` |
| `type` | String | enum: `contact`, `quote`, `callback`, `whatsapp`, `brochure`; default `contact` |
| `status` | String | enum: `new`, `contacted`, `qualified`, `quotation_sent`, `won`, `lost`; default `new` |
| `lostReason` | String | required when `status = lost` |
| `priority` | String | enum: `low`, `medium`, `high`; default `medium` |
| `assignedTo` | ObjectId → `users` | indexed |
| `source` | String | enum: `website`, `phone`, `email`, `whatsapp`, `referral`, `import`; default `website` |
| `sourcePage` | String | Path the form was submitted from |
| `utm` | Object | `{ source, medium, campaign, term, content }` |
| `referrer` | String | |
| `ipAddress` | String | Stored hashed — see below |
| `userAgent` | String | |
| `isSpam` | Boolean | default `false`, indexed |
| `spamScore` | Number | 0–100, from honeypot + rate + heuristics |
| `firstContactedAt` | Date | |
| `closedAt` | Date | |
| `estimatedValue` | Number | |
| + AuditFields | | |

**Indexes**
- `{ leadNumber: 1 }` unique
- `{ status: 1, createdAt: -1 }` — pipeline board, the hottest admin query
- `{ assignedTo: 1, status: 1 }` — "my leads"
- `{ createdAt: -1 }` — dashboard recency
- `{ email: 1, createdAt: -1 }` — duplicate detection
- `{ phone: 1 }`
- `{ productId: 1, createdAt: -1 }` — per-product inquiry reporting
- `{ isSpam: 1, createdAt: -1 }`
- `{ name: 'text', company: 'text', email: 'text', message: 'text' }` — admin search

**Rules**
- `leadNumber` is generated by an atomic `findOneAndUpdate` on a `counters` document keyed by year, never by `countDocuments()` (which races under concurrent submissions).
- Status transitions are validated in the service layer against a state machine, not free-set: `new → contacted → qualified → quotation_sent → won|lost`; any status may jump to `lost`; `won`/`lost` are terminal without an explicit reopen action.
- **Leads are never hard-deleted.** They are business records. Delete = soft delete, superadmin only.
- `ipAddress` is stored as a salted hash. The raw IP is used in-request for rate limiting and then discarded — it is personal data with no retention justification once the lead exists.
- A duplicate check on `email` within 24h flags rather than blocks; a genuine repeat inquiry must never be silently dropped.

### 5.8 `leadactivities`

Append-only history for the lead timeline in the admin panel.

| Field | Type | Constraint |
|---|---|---|
| `leadId` | ObjectId → `leads` | required, indexed |
| `userId` | ObjectId → `users` | null for system events |
| `type` | String | enum: `created`, `status_changed`, `assigned`, `note`, `email_sent`, `call_logged`, `quotation_sent` |
| `fromStatus` / `toStatus` | String | status changes only |
| `note` | String | max 2000 |
| `metadata` | Mixed | |
| `createdAt` | Date | |

**Indexes**
- `{ leadId: 1, createdAt: -1 }`
- `{ userId: 1, createdAt: -1 }`

Immutable: no update or delete path is exposed at any layer.

### 5.9 `settings`

Single-document collection (singleton) for site-wide values currently hardcoded in `Footer.jsx` and `Contact.jsx`.

| Field | Type | Notes |
|---|---|---|
| `key` | String | unique, always `"global"` |
| `company` | Object | `{ legalName, brandName, tagline, about }` |
| `contact` | Object | `{ phone, altPhone, whatsapp, email, salesEmail, website }` |
| `address` | Object | `{ line1, line2, city, state, pincode, country, mapEmbedUrl, latitude, longitude }` |
| `social` | Object | `{ facebook, linkedin, instagram, youtube, twitter }` |
| `logo` / `favicon` / `ogDefaultImage` | ImageRef | |
| `analytics` | Object | `{ gaMeasurementId, gtmContainerId, metaPixelId }` |
| `features` | Object | Feature flags: `{ blogEnabled, dealerNetworkEnabled, whatsappWidgetEnabled }` |
| `maintenanceMode` | Boolean | |
| + AuditFields | | |

Read-heavy and effectively static: cached in-process with a 5-minute TTL, invalidated on write.

### 5.10 `redirects`

Protects SEO when a slug changes.

| Field | Type | Constraint |
|---|---|---|
| `from` | String | required, unique, path only, leading `/` |
| `to` | String | required |
| `statusCode` | Number | enum: 301, 302; default 301 |
| `hitCount` | Number | default 0 |
| `isActive` | Boolean | default `true` |
| + AuditFields | | |

**Indexes:** `{ from: 1 }` unique · `{ isActive: 1 }`

Created automatically by the service layer whenever a published document's slug changes. Redirect chains are collapsed on write: if `A → B` exists and `B → C` is created, `A` is rewritten to point at `C`.

### 5.11 `activitylogs`

Admin audit trail across all modules.

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId → `users` | |
| `action` | String | enum: `create`, `update`, `delete`, `publish`, `unpublish`, `login`, `logout`, `login_failed`, `export` |
| `entityType` | String | `product`, `category`, `page`, `lead`, `media`, `user`, `settings` |
| `entityId` | ObjectId | |
| `changes` | Mixed | `{ field: { from, to } }` — diff only, never full documents |
| `ipHash` | String | |
| `userAgent` | String | |
| `createdAt` | Date | |

**Indexes**
- `{ userId: 1, createdAt: -1 }`
- `{ entityType: 1, entityId: 1, createdAt: -1 }`
- `{ createdAt: 1 }` **TTL, 365 days**

`changes` never records `passwordHash`, tokens, or any `select: false` field — the diff builder works from an explicit allowlist per entity type.

### 5.12 `pageviews`

Backs the "Product Views" dashboard metric in [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md). Deliberately minimal — this is not a replacement for GA4.

| Field | Type | Notes |
|---|---|---|
| `path` | String | indexed |
| `entityType` | String | `product`, `page`, `category` |
| `entityId` | ObjectId | |
| `sessionHash` | String | Salted hash of IP + UA + day; dedupes without storing identity |
| `referrer` | String | |
| `device` | String | enum: `mobile`, `tablet`, `desktop` |
| `createdAt` | Date | |

**Indexes**
- `{ entityType: 1, entityId: 1, createdAt: -1 }`
- `{ createdAt: 1 }` **TTL, 90 days**
- `{ sessionHash: 1, entityId: 1, createdAt: -1 }` — dedupe within a session

Rolled up nightly into a `pageviewdaily` aggregate so dashboard queries never scan raw events.

---

## 6. Index Summary

Every index below is declared in the schema, not created ad hoc in a shell. `autoIndex` is enabled in development and **disabled in production**; production indexes are applied by an explicit, idempotent migration step in the deploy pipeline.

| Collection | Index | Type | Serves |
|---|---|---|---|
| users | `email` | unique | login |
| refreshtokens | `tokenHash` | unique | token lookup |
| refreshtokens | `expiresAt` | TTL 0 | auto-cleanup |
| categories | `slug` | unique partial | public routing |
| categories | `status, displayOrder` | compound | category listing |
| products | `slug` | unique partial | public routing |
| products | `status, displayOrder` | compound | product listing |
| products | `categoryId, status, displayOrder` | compound | category page |
| products | `isFeatured, status` | compound | homepage |
| products | text index | text | admin search |
| media | `folder, createdAt` | compound | library browse |
| media | `checksum` | single | dedupe |
| media | text index | text | library search |
| pages | `key` | unique | page fetch |
| leads | `leadNumber` | unique | reference |
| leads | `status, createdAt` | compound | pipeline board |
| leads | `assignedTo, status` | compound | my leads |
| leads | `productId, createdAt` | compound | product reporting |
| leads | text index | text | admin search |
| leadactivities | `leadId, createdAt` | compound | timeline |
| activitylogs | `createdAt` | TTL 365d | retention |
| pageviews | `createdAt` | TTL 90d | retention |

**Cap:** at most one text index per collection — MongoDB permits no more. Where richer search is needed later, it moves to Atlas Search rather than a second text index.

---

## 7. Connection & Runtime Configuration

The current `config/db.js` has three defects to correct during Phase 1:

1. **`process.exit(1)` on connection failure** kills the process before Express can report anything. Replace with a rejected promise the bootstrap handles, so startup failure is logged with context and the process exits with an intelligible message.
2. **No connection options.** Add `maxPoolSize` (default 10), `minPoolSize` (2), `serverSelectionTimeoutMS` (5000), `socketTimeoutMS` (45000).
3. **No lifecycle handling.** Add listeners for `connected`, `error`, `disconnected`, plus a `SIGTERM`/`SIGINT` handler that closes the connection cleanly.

Also: `mongoose.set('strictQuery', true)` and `mongoose.set('sanitizeFilter', true)`. The latter is the schema-level defence against NoSQL operator injection through query parameters — a real risk given the current `contactController` passes `req.body` fields straight into `Contact.create`.

**Environment variables** (`.env.example` is currently empty and must be filled):

```
MONGO_URI
MONGO_DB_NAME
PORT
NODE_ENV
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRY
JWT_REFRESH_EXPIRY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLIENT_URL
ADMIN_URL
IP_HASH_SALT
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM
```

> **Correction to an earlier version of this document:** `server/.env` is not committed — the project has no git repository at all, so `.gitignore` is currently inert. The file holds `MONGO_URI` and `JWT_SECRET` in plaintext in a Downloads folder. The rotation recommendation stands, and initialising version control *before* the first commit is what keeps it out of history. See [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §5.

---

## 8. Migration Plan

### M1 — `contacts` → `leads`

The existing collection has real submissions and must be preserved.

1. Create `leads` with the full schema.
2. Copy each `contacts` document: map `name`, `email`, `phone`, `company`, `message`, `createdAt`, `updatedAt` directly.
3. Backfill defaults: `status: 'new'`, `type: 'contact'`, `source: 'website'`, `priority: 'medium'`, `isDeleted: false`.
4. Assign `leadNumber` in `createdAt` order.
5. Write a `leadactivities` `created` record per lead, with `userId: null`.
6. Keep `contacts` read-only for one release as a rollback path, then archive.

Migrations are numbered, forward-only, idempotent scripts under `server/migrations/`, each recording its name in a `_migrations` collection.

### M2 — Hardcoded content → `products` / `categories`

Source data is the arrays in `client/src/pages/Products.jsx` and `Packaging.jsx`. Field mapping is specified in [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §8.

> Note for whoever runs this: the `subtitle` values in `Products.jsx` are wrong in the current code — `10L Can` carries `"18L"` and `20L Can` carries `"10L"`. Do not migrate them as volumes. See [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §2.

### M3 — Hardcoded page content → `pages`

Each of the eight React pages becomes one `pages` document with its sections extracted. Existing images are uploaded to Cloudinary and become `media` documents; the local `client/src/assets/images` tree is retained until the CMS is verified, then removed.

### M4 — Footer/Contact constants → `settings`

Seeds the singleton from the literals currently in `Footer.jsx` and `Contact.jsx`. Placeholder values (`+91 12345 67890`, `Plot No. ___`) migrate as-is and become editable rather than being invented here.

---

## 9. Data Integrity Rules

| Rule | Enforced at |
|---|---|
| Slug uniqueness | Unique partial index + service-level pre-check for a friendly error |
| Slug immutability after publish | Service layer; change creates a `redirects` record |
| Referential integrity (`categoryId`, `mediaId`, `productId`) | Service layer — MongoDB has no foreign keys |
| Cascade on category archive | Blocked if published products reference it |
| Cascade on media delete | Blocked if `usageCount > 0` |
| Lead status transitions | Service-layer state machine |
| Lead hard delete | Prohibited at the repository layer |
| Required-field validation | Mongoose schema (first line) + request validator (before that) |
| Sanitisation of rich text | Service layer on write, allowlist-based |

Per [ARCHITECTURE.md](ARCHITECTURE.md), **repositories perform database operations only**. Every rule above that says "service layer" belongs in a service; no repository method may contain a business condition, and no controller may contain either.

---

## 10. Open Questions

These need a decision from the business before Phase 2 modelling is final:

1. **Are packaging sizes products, or variants of one product?** The current site presents them as four products on `/products` *and* four packages on `/packaging`, with the same four SKUs. [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §3 recommends one product ("Dhudhat DEF") with four packaging variants, but this changes the URL structure and needs sign-off.
2. **Is there more than one DEF grade?** If a second product line is planned (e.g. AdBlue-branded, or bulk tanker supply), the category tree matters now rather than later.
3. **Lead data retention period.** Leads currently have no TTL by design. Confirm whether a retention policy is required for compliance.
4. **Multi-language?** No i18n is modelled. Adding it later means a `translations` sub-document on every content collection — cheap now, expensive after launch.
