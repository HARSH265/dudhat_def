# Product Data Model

> Status: Planning document. No code written yet.
> Scope: How Dudhat DEF products, packaging, and specifications are modelled.
> Related: [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md), [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md), [API_SPECIFICATION.md](API_SPECIFICATION.md), [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md)

---

## 1. Current State

Product data exists only as literal arrays in two React files.

**`client/src/pages/Products.jsx`**

```
{ image: can10L,    title: "10L Can",        subtitle: "18L"   }
{ image: can20L,    title: "20L Can",        subtitle: "10L"   }
{ image: drum210L,  title: "210L Drum",      subtitle: "350L"  }
{ image: ibc1000L,  title: "1000L IBC Tank", subtitle: "1000L" }
```

**`client/src/pages/Packaging.jsx`** — the same four items, different images, no subtitle:

```
{ image: pack10L,   title: "10L Can"        }
{ image: pack20L,   title: "20L Can"        }
{ image: pack210L,  title: "210L Drum"      }
{ image: pack1000L, title: "1000L IBC Tank" }
```

Supporting attributes are scattered across pages as feature cards: "High Purity / 99.9% Purity", "ISO 22241 / Compliant", "Long Shelf Life / 18 Months", "Engine Safe / & Reliable" (Products); "Leak Proof", "Easy to Store", "Tamper Proof Cap", "100% Recyclable" (Packaging).

There is no category, no description, no specification, no application list, no brochure, no SEO, and no product detail page.

---

## 2. Data Defect in the Current Content

The `subtitle` values on the Products page are wrong and should not be carried into the database:

| Product | Current subtitle | Almost certainly meant |
|---|---|---|
| 10L Can | `"18L"` | 18 months shelf life |
| 20L Can | `"10L"` | 10 litres — one row misaligned |
| 210L Drum | `"350L"` | unclear; not 350 litres |
| 1000L IBC Tank | `"1000L"` | correct by coincidence |

Three of four are wrong, and they are currently rendered to the public. The pattern looks like a shifted column during hand-entry — precisely the failure mode a typed data model prevents. Migration M2 in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §8 must take volumes from the product titles, not from `subtitle`, and the values above should be confirmed with the business rather than inferred.

This is also the argument for the CMS in one screenshot: content maintained as positional arrays in JSX drifts, and nobody notices.

---

## 3. Core Modelling Decision: Product vs. Packaging Variant

**The single most important decision in this document.**

The site currently presents the same four SKUs twice — as four *products* on `/products` and as four *packages* on `/packaging`. That is a modelling ambiguity, not a content choice, and it must be resolved before anything is built.

### The reality

Dudhat DEF is **one chemical product** — a 32.5% aqueous urea solution meeting ISO 22241. The 10L can, 20L can, 210L drum, and 1000L IBC are four *containers* for the same fluid. They share every specification: purity, urea concentration, density, shelf life, compliance. They differ only in volume, container type, handling, and minimum order quantity.

### Options

| Option | Structure | Assessment |
|---|---|---|
| **A — Four products** | Each container is a `products` document | Matches the current site exactly. But it duplicates the entire specification table four times, so an ISO recertification means four edits and four chances to introduce a drift. |
| **B — One product, four packaging variants** | One `products` document with an embedded `packaging[]` array | Specifications live once. Container details live per variant. Matches physical reality. |
| **C — Product + separate variants collection** | Variants as their own collection | Correct if variants carry independent pricing, stock, and SKUs across many products. Over-built for four containers of one fluid. |

### Decision: **Option B**, adopted provisionally

Adopted so Phase 2 can proceed — see [SEED_DATA.md](SEED_DATA.md) §1. Reversible at any point: Option B expresses Option A by giving each product a single-element `packaging[]`, with no schema, API, or admin change.

**Evidence found after this document was first written:** the four `packaging/*.png` files are byte-identical to the four `products/*.png` files (matching MD5 checksums). There is no separate packaging photography — the same four images are duplicated across two folders. `/products` and `/packaging` are two presentations of one set of items, which is exactly what Option B models.

One product document, four embedded packaging variants. Crucially, this does **not** require changing what visitors see:

- `/products` renders a card per packaging variant, driven by `product.packaging[]` — visually identical to today.
- `/packaging` renders the same variants with the packaging-focused imagery and attributes.
- `/products/def-32-5` is the new detail page holding the specification table, applications, gallery, and brochure.

The public URL structure and the CMS structure are allowed to differ; the CMS should model the truth, and the presentation layer should serve the marketing story.

**Option B also unblocks growth.** If a second grade is introduced later (bulk tanker supply, an AdBlue-branded line, a private-label product), each is a new product with its own specifications and its own variant set — no restructuring.

**Escape hatch.** If the business confirms these really are distinct products with distinct specifications, the model degrades gracefully: create four products, each with a single-element `packaging[]`. Nothing in the schema, API, or admin panel changes. That asymmetry is why B is the safe default — B can express A, but A cannot express B.

> **Needs sign-off before Phase 2.** Recorded as open question 1 in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §10.

---

## 4. Product Schema

### 4.1 Identity

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | String | yes | `"Dudhat DEF"` — trim, 2–150 |
| `slug` | String | yes | Auto from `name`, unique, lowercase, immutable after publish |
| `sku` | String | no | Base SKU; variants extend it |
| `tagline` | String | no | ≤ 120 — `"32.5% High Purity Diesel Exhaust Fluid"` |
| `categoryId` | ObjectId | yes | → `categories` |
| `categoryName` | String | — | Denormalised for list rendering |

### 4.2 Content

| Field | Type | Notes |
|---|---|---|
| `shortDescription` | String | ≤ 300 — card and meta-description fallback |
| `description` | String | Rich text, sanitised HTML allowlist |
| `highlights` | [String] | ≤ 6 bullets for the detail page |
| `badges` | [String] | `"ISO 22241"`, `"99.9% Purity"`, `"18 Months Shelf Life"` — these are the feature cards currently hardcoded on `Products.jsx`, promoted to data |

### 4.3 `specifications[]` — `SpecItem`

The technical table. Structured rows, not a rich-text blob, so they can be filtered, compared, and emitted as `Product` JSON-LD.

| Field | Type | Required | Notes |
|---|---|---|---|
| `group` | String | no | Section heading — `"Chemical"`, `"Physical"`, `"Storage"`, `"Compliance"` |
| `label` | String | yes | `"Urea Concentration"` |
| `value` | String | yes | `"32.5"` — string, not number: values are often ranges (`"1.087–1.093"`) or qualifiers (`"Max 0.3"`) |
| `unit` | String | no | `"% by weight"` |
| `standard` | String | no | Test method — `"ISO 22241-2"` |
| `order` | Number | no | Sort within group |
| `isKey` | Boolean | no | Surfaces in the card/summary strip |

**`value` as String is deliberate.** DEF specifications are expressed as limits and ranges far more often than as single numbers. Forcing them numeric would mean either losing the qualifier or inventing `min`/`max`/`operator` columns that most rows leave empty. The trade-off is no numeric filtering — acceptable, since nobody filters DEF by refractive index.

**ISO 22241-1 template** — the admin panel's "Load ISO 22241 template" button prefills these rows. Values below are the published standard limits and must be confirmed against Dudhat's own Certificate of Analysis before publishing.

| Group | Label | Typical value | Unit | Standard |
|---|---|---|---|---|
| Chemical | Urea Concentration | 31.8 – 33.2 | % by weight | ISO 22241-2 |
| Chemical | Alkalinity as NH₃ | Max 0.2 | % | ISO 22241-2 |
| Chemical | Biuret | Max 0.3 | % | ISO 22241-2 |
| Chemical | Aldehydes | Max 5 | mg/kg | ISO 22241-2 |
| Chemical | Insoluble Matter | Max 20 | mg/kg | ISO 22241-2 |
| Chemical | Phosphate (PO₄) | Max 0.5 | mg/kg | ISO 22241-2 |
| Chemical | Total Alkali Metals | Max 0.5 | mg/kg | ISO 22241-2 |
| Physical | Density @ 20 °C | 1.087 – 1.093 | g/cm³ | ISO 22241-2 |
| Physical | Refractive Index @ 20 °C | 1.3814 – 1.3843 | — | ISO 22241-2 |
| Physical | Appearance | Clear, colourless | — | Visual |
| Physical | Crystallisation Point | −11 | °C | ISO 22241-1 |
| Storage | Shelf Life | 18 | months | ISO 22241-3 |
| Storage | Storage Temperature | −5 to +25 | °C | ISO 22241-3 |
| Compliance | Standard | ISO 22241-1 | — | — |

Trace metals (Ca, Fe, Cu, Zn, Cr, Ni, Al, Mg, Na, K) are additional rows in the Chemical group where the CoA reports them.

### 4.4 `packaging[]` — `PackagingVariant`

The four containers.

| Field | Type | Required | Notes |
|---|---|---|---|
| `label` | String | yes | `"10L Can"` — the display name used on cards today |
| `slug` | String | yes | `"10l-can"` — unique within the product |
| `volume` | Number | yes | `10` — numeric, so sorting and comparison work |
| `unit` | String | yes | enum: `L`, `mL`, `kg` |
| `containerType` | String | yes | enum: `can`, `drum`, `ibc`, `bottle`, `tanker` |
| `material` | String | no | `"HDPE"` |
| `sku` | String | no | `"DDEF-10L"` |
| `image` | ImageRef | no | Product-context image (`products/can-10l.png`) |
| `packagingImage` | ImageRef | no | Packaging-context image. **Left unpopulated** — the current `packaging/*.png` files are byte-identical duplicates of `products/*.png`, so there is nothing distinct to store. Field retained for when real packaging photography exists |
| `dimensions` | Object | no | `{ length, width, height, unit }` |
| `grossWeight` | Number | no | kg |
| `unitsPerPallet` | Number | no | Logistics detail buyers ask for |
| `moq` | String | no | `"10 cans"` |
| `features` | [String] | no | `"Leak Proof"`, `"Tamper Proof Cap"`, `"100% Recyclable"` — the packaging feature cards, promoted to data |
| `isAvailable` | Boolean | — | default `true` |
| `displayOrder` | Number | — | Ascending volume by default |

The dual-image design was intended to preserve the current site's two-page presentation from a single record. In practice both folders hold the same bytes, so one `image` per variant is sufficient today and both pages render from it. Today's two disconnected arrays can silently disagree; one variant record cannot.

**No price field.** Industrial DEF is quoted, not listed — [PROJECT_BIBLE.md](PROJECT_BIBLE.md) makes quote requests a primary conversion action, and publishing prices would undercut that. `moq` and `estimatedValue` on the lead carry the commercial signal instead.

**No stock field.** Inventory belongs in an ERP, not a marketing CMS. `isAvailable` is a manual on/off, nothing more.

### 4.5 `applications[]`

Simple string array — who uses this and where. Drives filtering, SEO long-tail, and buyer self-identification.

`"Trucks & Buses"` · `"Construction Equipment"` · `"Agricultural Machinery"` · `"Generators & Gensets"` · `"Mining Equipment"` · `"Marine Engines"` · `"Fleet Operations"`

These map onto the target users listed in [PROJECT_BIBLE.md](PROJECT_BIBLE.md) — dealers, distributors, fleet operators, industrial buyers, procurement teams — and are the strongest available signal for which product page a search visitor should land on.

### 4.6 Media

| Field | Type | Notes |
|---|---|---|
| `primaryImage` | ImageRef | Card and OG fallback. Required to publish |
| `gallery` | [ImageRef] | Ordered; detail-page carousel |
| `brochure` | ObjectId → `media` | PDF. Download is tracked as a lead event |
| `certificates` | [ObjectId → `media`] | CoA, ISO certificate — high trust value for procurement buyers |
| `video` | String | Optional embed URL |

### 4.7 Merchandising & Analytics

| Field | Type | Notes |
|---|---|---|
| `isFeatured` | Boolean | Homepage strip |
| `displayOrder` | Number | Manual sort |
| `relatedProductIds` | [ObjectId] | Manual override; falls back to same-category |
| `viewCount` | Number | `$inc` only, buffered |
| `inquiryCount` | Number | `$inc` on lead creation |
| `brochureDownloads` | Number | `$inc` |

`inquiryCount` is the number that matters. Views measure traffic; inquiries measure the thing [PROJECT_BIBLE.md](PROJECT_BIBLE.md) lists as a success metric.

### 4.8 Publishing & SEO

| Field | Type | Notes |
|---|---|---|
| `status` | String | `draft` \| `published` \| `archived` |
| `publishedAt` | Date | |
| `seo` | SeoMeta | Shared sub-document — [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §4.1 |
| + AuditFields | | |

---

## 5. Category Model

Categories exist even though the current catalogue has one line, because [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md) specifies them and because the growth paths in [PROJECT_BIBLE.md](PROJECT_BIBLE.md) imply more than one product family.

| Field | Type | Notes |
|---|---|---|
| `name` | String | `"Diesel Exhaust Fluid"` |
| `slug` | String | `"diesel-exhaust-fluid"` |
| `description` | String | Intro copy for the category page |
| `image` | ImageRef | |
| `parentId` | ObjectId | One level of nesting maximum |
| `displayOrder` | Number | |
| `status` | String | `draft` \| `published` \| `archived` |
| `seo` | SeoMeta | |

**Seed set:**

```
Diesel Exhaust Fluid  (def)                ← all current products
Packaging Solutions   (packaging-solutions) ← optional, if /packaging becomes a category page
```

Starting with one real category is correct. Inventing a taxonomy for a single product line produces empty category pages, which are an SEO liability rather than an asset.

---

## 6. Worked Example

Option B applied to the current catalogue.

```json
{
  "name": "Dudhat DEF",
  "slug": "Dudhat-def",
  "tagline": "32.5% High Purity Diesel Exhaust Fluid",
  "sku": "DDEF",
  "categoryId": "<def-category-id>",
  "categoryName": "Diesel Exhaust Fluid",

  "shortDescription": "High quality Diesel Exhaust Fluid (DEF) for reduced emissions and better engine performance.",
  "description": "<p>Dudhat DEF is a high-purity aqueous urea solution ...</p>",

  "highlights": [
    "99.9% purity, manufactured to ISO 22241",
    "Reduces harmful NOx emissions in SCR systems",
    "18-month shelf life under recommended storage",
    "Available from 10L cans to 1000L IBC tanks"
  ],

  "badges": ["ISO 22241", "99.9% Purity", "18 Months Shelf Life", "Engine Safe"],

  "specifications": [
    { "group": "Chemical", "label": "Urea Concentration", "value": "31.8 – 33.2", "unit": "% by weight", "standard": "ISO 22241-2", "isKey": true,  "order": 1 },
    { "group": "Chemical", "label": "Biuret",             "value": "Max 0.3",     "unit": "%",            "standard": "ISO 22241-2", "isKey": false, "order": 2 },
    { "group": "Physical", "label": "Density @ 20 °C",    "value": "1.087 – 1.093","unit": "g/cm³",       "standard": "ISO 22241-2", "isKey": false, "order": 1 },
    { "group": "Physical", "label": "Appearance",         "value": "Clear, colourless", "unit": "",       "standard": "Visual",      "isKey": false, "order": 2 },
    { "group": "Storage",  "label": "Shelf Life",         "value": "18",          "unit": "months",       "standard": "ISO 22241-3", "isKey": true,  "order": 1 }
  ],

  "packaging": [
    {
      "label": "10L Can", "slug": "10l-can", "volume": 10, "unit": "L",
      "containerType": "can", "material": "HDPE", "sku": "DDEF-10L",
      "image":          { "url": "/media/products/can-10l.png",  "alt": "Dudhat DEF 10L can" },
      "packagingImage": { "url": "/media/packaging/pack-10l.png","alt": "Dudhat DEF 10L can packaging" },
      "features": ["Leak Proof", "Tamper Proof Cap", "100% Recyclable"],
      "isAvailable": true, "displayOrder": 1
    },
    { "label": "20L Can",        "slug": "20l-can",   "volume": 20,   "unit": "L", "containerType": "can",  "sku": "DDEF-20L",   "displayOrder": 2, "isAvailable": true },
    { "label": "210L Drum",      "slug": "210l-drum", "volume": 210,  "unit": "L", "containerType": "drum", "sku": "DDEF-210L",  "displayOrder": 3, "isAvailable": true },
    { "label": "1000L IBC Tank", "slug": "1000l-ibc", "volume": 1000, "unit": "L", "containerType": "ibc",  "sku": "DDEF-1000L", "displayOrder": 4, "isAvailable": true }
  ],

  "applications": [
    "Trucks & Buses", "Construction Equipment", "Agricultural Machinery",
    "Generators & Gensets", "Fleet Operations"
  ],

  "isFeatured": true,
  "displayOrder": 1,
  "status": "published",

  "seo": {
    "metaTitle": "Dudhat DEF | ISO 22241 Diesel Exhaust Fluid Supplier",
    "metaDescription": "High purity 32.5% Diesel Exhaust Fluid manufactured to ISO 22241. Available in 10L, 20L, 210L and 1000L packaging. Request a quote.",
    "schemaType": "Product",
    "ogType": "product"
  }
}
```

---

## 7. Structured Data

`schemaType: "Product"` emits JSON-LD on the detail page. This matters — procurement buyers search by specification, and structured data is how those queries find the page.

Emitted from the model:

| Schema.org property | Source |
|---|---|
| `name` | `name` |
| `description` | `shortDescription` |
| `image` | `primaryImage` + `gallery` |
| `brand` | `settings.company.brandName` |
| `manufacturer` | `settings.company.legalName` |
| `sku` | `sku` |
| `category` | `categoryName` |
| `additionalProperty[]` | `specifications[]` → `PropertyValue { name, value, unitText }` |
| `hasVariant[]` | `packaging[]` |
| `offers` | Omitted — no public pricing |

`offers` is deliberately absent. Emitting a fake or zero price to satisfy a validator warning is worse than omitting the property.

---

## 8. Migration Mapping

For migration M2 in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §8.

| Source | Target |
|---|---|
| `Products.jsx` → `products[].title` | `packaging[].label`, and `volume`/`unit`/`containerType` parsed from it |
| `Products.jsx` → `products[].subtitle` | **Discard.** See §2 |
| `Products.jsx` → `products[].image` | `packaging[].image` |
| `Packaging.jsx` → `packages[].image` | `packaging[].packagingImage` |
| `Products.jsx` → `features[]` | `badges[]` + the corresponding `specifications[]` rows |
| `Packaging.jsx` → `features[]` | `packaging[].features[]` (applied to all variants) |
| `assets/images/products/*` | `media` documents, folder `products` |
| `assets/images/packaging/*` | `media` documents, folder `packaging` |
| Page copy on `/products` | `pages` document, key `products`, `productGrid` section |

Parsing rule for `title` → variant fields:

```
"10L Can"        → volume 10,   unit L, containerType can
"20L Can"        → volume 20,   unit L, containerType can
"210L Drum"      → volume 210,  unit L, containerType drum
"1000L IBC Tank" → volume 1000, unit L, containerType ibc
```

The migration is a one-off script with four hand-verified records — it should not attempt to be a general parser.

---

## 9. Validation Rules

| Rule | Layer |
|---|---|
| `slug` unique across products | Unique index + service pre-check |
| `slug` immutable after publish | Service; creates a `redirects` record |
| `categoryId` resolves to a live category | Service |
| `packaging[].slug` unique within the product | Service |
| `packaging[].volume` > 0 | Schema |
| `packaging[].unit` in enum | Schema |
| `specifications[].label` + `value` both present | Schema |
| Every `mediaId` resolves | Service |
| `description` HTML sanitised | Service, on write |
| Publish requires `primaryImage`, `shortDescription`, ≥ 1 specification | Service |
| Publish requires ≥ 1 available packaging variant | Service |
| `viewCount` / `inquiryCount` written with `$inc` only | Repository |

Per [ARCHITECTURE.md](ARCHITECTURE.md), none of these live in a controller.

---

## 10. Deferred

Explicitly out of scope, recorded so they are not re-litigated:

- **Pricing and offers** — DEF is quote-based
- **Stock and inventory** — ERP concern
- **Cart and checkout** — not an e-commerce site; the conversion is a lead
- **Product comparison** — needs more than one product line first
- **Reviews and ratings** — B2B industrial buyers do not use them
- **Product-level i18n** — see open question 4 in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md)
- **Batch and lot traceability** — [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)-adjacent claim on `Quality.jsx` ("Batch Traceability & Records"), but the records themselves are a QA system concern, not a website one

---

## 11. Decisions

| # | Decision | Status |
|---|---|---|
| 1 | Option A or Option B (§3) | **Resolved** — Option B, provisionally. [SEED_DATA.md](SEED_DATA.md) §1 |
| 2 | Correct volumes and shelf life (§2) | **Resolved** — volumes taken from titles; `subtitle` discarded. [SEED_DATA.md](SEED_DATA.md) §3 |
| 3 | Actual specification values | **Unblocked with placeholders, still open.** ISO limits seeded and flagged `isPlaceholder: true`; the publish gate rejects them. Real CoA required before launch — [SEED_DATA.md](SEED_DATA.md) § Launch Gate |
| 4 | `/packaging` — distinct copy or canonicalise? | Open. Resolution options in [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §4.1 |
| 5 | More product lines coming? | Open. Determines whether the category tree is needed on day one |

Decision 3 is the one that must not be forgotten: development proceeds on placeholder specifications, and publishing them as measured results would misstate the product to buyers who purchase on specification.
