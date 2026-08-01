# Phase 2C Review — Categories & Products

> **HISTORICAL.** Findings fixed and recorded. Kept for the record.
> Do not read for current state — see [PROJECT_STATUS.md](PROJECT_STATUS.md).

> Scope: `server/` catalogue modules. Backend only — no public UI touched, design freeze respected.
> Method: static typecheck plus behavioural testing against the live Atlas connection and the real Cloudinary account. Every result below was reproduced, not inferred.

---

## 1. Blockers Found Before Coding

Three gaps surfaced during the pre-implementation review. All three were resolved rather than worked around.

| # | Gap | Resolution |
|---|---|---|
| B1 | `isPlaceholder` was referenced by [SEED_DATA.md](SEED_DATA.md) and the publish gate but absent from the `SpecItem` field table in [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §4.3 — the enforcement mechanism had no field to read | Added to the schema, validator, and both docs |
| B2 | [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §9 requires a 301 redirect when a published slug changes, but the `redirects` collection is Phase 3 | Slug changes on published content are **refused** with 409 rather than silently breaking inbound links. Lifts automatically when redirects land |
| B3 | The seed product slug in [SEED_DATA.md](SEED_DATA.md) §3 reads `Dudhat-def` with a capital D — a casualty of the global rename. Slugs are URL keys and must be lowercase | Flagged; the validator rejects it, and `slugify()` would produce `dudhat-def` |

---

## 2. What Was Built

| Module | Files |
|---|---|
| Models | `Category.ts`, `Product.ts`, `shared.ts` (SeoMeta + ContentStatus) |
| Repositories | `catalogue.repository.ts` (category + product) |
| Services | `category.service.ts`, `product.service.ts`, `mediaUsage.service.ts`, `catalogueMapper.ts` |
| Controller | `catalogue.controller.ts` |
| Validators | `catalogue.validator.ts` |
| Routes | `admin/catalogue.routes.ts` |
| Script | `reconcileMediaUsage.ts` |

**Endpoints — 13**

```
GET    /admin/categories          POST   /admin/categories
GET    /admin/categories/:id      PUT    /admin/categories/:id
PATCH  /admin/categories/:id/status
DELETE /admin/categories/:id

GET    /admin/products            POST   /admin/products
GET    /admin/products/:id        PUT    /admin/products/:id
PATCH  /admin/products/:id/status PATCH  /admin/products/reorder
POST   /admin/products/:id/duplicate
DELETE /admin/products/:id
```

---

## 3. Verification Results

All against a running server. ✅ = behaved as specified.

### Publish gate

| Case | Result |
|---|---|
| Publish with `isPlaceholder: true` spec | ✅ 422, names the offending spec by label |
| Publish with `[PLACEHOLDER]` in a badge | ✅ 422, quotes the badge text |
| Both at once | ✅ **Both** reported in one response, not just the first |
| Publish a clean product | ✅ 200, `publishedAt` stamped |
| Missing primary image / short description / specs / available variant | ✅ each blocks |

The gate returns every blocker at once. A publish dialog that reveals one problem at a time makes the editor guess how many remain.

**Extension beyond the brief:** the prompt asked for placeholder-*specification* checks. Badges, tagline and shortDescription are also scanned for `[PLACEHOLDER]`, because a badge reading `[PLACEHOLDER] ISO 22241` asserts a certification with no evidence behind it — the same class of false claim the spec check exists to prevent.

### Media usage integration

| Case | Result |
|---|---|
| Product created referencing media | ✅ `usageCount` → 1 |
| Delete that media | ✅ 409, "used in 1 place and cannot be deleted" |
| Update product to clear the references | ✅ `usageCount` → 0 |
| Delete media again | ✅ 200 |
| `reconcile:media` after the sequence | ✅ "No drift" |

**Design note on the count.** References are **deduplicated per document**. An asset used as both `primaryImage` and a packaging variant image counts once, not twice. Counting slots rather than documents would leave an asset undeletable after the referencing product was gone. Increment and decrement are symmetric, so the count stays correct either way — deduplicating just makes the UI message ("used in 1 place") true.

**Deliberately not transactional.** `usageCount` is a safety guard, not financial data. Coupling every catalogue write to a replica-set session is disproportionate. Instead the ordering makes the failure direction safe — a count that is too high blocks a legitimate delete (recoverable) rather than too low, which would allow deleting a referenced asset and leave broken images live — and `npm run reconcile:media` repairs drift idempotently.

### Categories

| Case | Result |
|---|---|
| Create with auto-derived slug | ✅ `diesel-exhaust-fluid` |
| Duplicate slug | ✅ 409 `DUPLICATE_SLUG` |
| Three-level nesting | ✅ 400, one level only |
| Category as its own parent | ✅ 400 |
| Archive with a published product | ✅ 409, names the blocking product |
| Delete with any products | ✅ 409, states the count |
| Rename propagates `categoryName` | ✅ denormalised copy refreshed |

### Products

| Case | Result |
|---|---|
| Slug change on a **published** product | ✅ 409 (B2) |
| Slug change on a draft | ✅ allowed |
| Duplicate | ✅ `-copy` suffix, forced to draft, counters reset to 0, SKU cleared |
| Packaging variant slug uniqueness | ✅ enforced in the validator |
| Non-existent media reference | ✅ 400 |
| Non-existent category | ✅ 400 |

### RBAC

| Role | list | create | delete | publish category |
|---|---|---|---|---|
| `editor` | 200 | 201 | **403** | **403** |
| `sales` | **403** | — | — | — |
| `admin` / `superadmin` | 200 | 201 | 200 | 200 |

`sales` is excluded from the catalogue entirely, mirroring `editor` being excluded from leads — role separation runs both ways.

---

## 4. Architecture Compliance

| Rule | Status |
|---|---|
| No business logic in controllers | ✅ Controllers read validated input, call one service, shape the response |
| Controller → Service → Repository | ✅ No repository is imported by a controller |
| Existing `AppError` pattern | ✅ All failures are typed `AppError` with stable error codes |
| Existing validation architecture | ✅ zod schemas as middleware; unknown keys stripped |
| Existing RBAC architecture | ✅ `authorize()` per route; `authenticate` at the mount |
| Audit logging | ✅ Every create, update, publish, unpublish and delete writes an `activitylogs` entry |
| Typecheck | ✅ Clean under `strict` + `noUncheckedIndexedAccess` |

**One new file worth explaining.** `catalogueMapper.ts` converts validated input (plain strings for identifiers) into model shapes (`ObjectId`). Without it, every service would carry `as unknown as` casts at the boundary. One auditable conversion point is better than a dozen scattered assertions.

---

## 5. Known Gaps

| Gap | Why it is deferred |
|---|---|
| `GET /admin/media/:id/usage` | Listing *which* documents reference an asset needs a reverse query across products and categories. The count and the delete guard work; the itemised list is a panel affordance for 2F |
| Public catalogue endpoints (`/api/v1/products`, `/categories`) | The prompt scoped 2C to admin modules. Public read endpoints belong with the front-end work that consumes them |
| `viewCount` / `inquiryCount` / `brochureDownloads` | Fields exist and are `$inc`-safe, but nothing increments them until the public endpoints and `pageviews` land |
| Rich-text sanitisation of `description` | [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §6 requires allowlist sanitisation on write. `description` currently accepts raw HTML up to 20 000 chars. **Nothing renders it yet**, so there is no live XSS path — but this must land before any surface renders it |
| Category `displayOrder` bulk reorder | Products have it; categories do not. Low value at two categories |

**The sanitisation gap is the one to watch.** It is safe only because no renderer exists. It must be closed in the same change that first renders `description`.

---

## 6. Recommendation

2C is complete and internally consistent. Nothing here blocks 2D.

Before the catalogue goes live, two items outside this phase still gate it: the real Certificate of Analysis values (the publish gate refuses placeholders by design), and rich-text sanitisation before anything renders `description`.
