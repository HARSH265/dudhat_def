# Seed Data — Placeholder Values

> **Every value in this file is a placeholder.** It exists so development is not blocked on business inputs.
> All placeholder values are collected here, in one file, so replacing them later is one edit — not a search across the codebase.

---

## Launch Gate

**None of these values may reach production.** Three of them would be factually false statements about the product or the company if published.

| Value set | Publishing risk if not replaced |
|---|---|
| Product specifications (§3) | States untested figures as measured results. Misrepresents the product to buyers who purchase on specification |
| Company address / phone / email (§2) | Publishes a non-existent business address. Breaks `LocalBusiness` schema and local SEO NAP consistency ([SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §8) |
| Certifications (§3) | Claims a compliance status without a certificate to support it |

**Enforcement:** the publish gate in [API_SPECIFICATION.md](API_SPECIFICATION.md) §5.4 is extended to reject any product whose `specifications[]` still carries `"isPlaceholder": true`. Placeholder data fails the publish check rather than relying on someone remembering.

Every placeholder below is prefixed `[PLACEHOLDER]` in seed scripts so a grep for that string lists everything outstanding.

---

## 1. Product / Packaging Model — Adopted Provisionally

**Decision: Option B** — one product, four packaging variants ([PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §3).

Adopted as the working default so Phase 2 can proceed. It remains reversible: Option B expresses Option A by giving each product a single-element `packaging[]`, with no schema, API, or admin change.

### New evidence supporting this

The four packaging images are **byte-identical** to the four product images:

```
4d4eb787...  packaging/pack-10l.png   ==  products/can-10l.png
0468b93a...  packaging/pack-20l.png   ==  products/can-20l.png
d9dfb733...  packaging/pack-210l.png  ==  products/drum-210l.png
bd59c4d1...  packaging/pack-1000l.png ==  products/ibc-1000l.png
```

There is no separate packaging photography — the same four files are duplicated across two folders. This confirms `/products` and `/packaging` are two presentations of one set of items, which is what Option B models.

**Consequence:** the dual-image design in [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §4.4 (`image` + `packagingImage`) is unnecessary. One `image` per variant is enough until genuinely distinct packaging photography exists. `packagingImage` stays in the schema as optional and unpopulated.

---

## 2. Company Settings

Seeds the `settings` singleton ([DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.9, migration M4). Values marked ⚠️ are currently placeholders in `Footer.jsx` / `Contact.jsx` too — the seed carries the existing placeholder forward rather than inventing a plausible-looking fake address, which is more dangerous because it reads as real.

| Field | Placeholder value | Source |
|---|---|---|
| `company.legalName` | Dudhat Industries Private Limited | Real — from `Footer.jsx` |
| `company.brandName` | Dudhat DEF | Real |
| `company.tagline` | DRIVING CLEANER TOMORROW | Real |
| `company.about` | *(existing Footer copy)* | Real |
| `contact.phone` | ⚠️ `[PLACEHOLDER] +91 12345 67890` | Placeholder in current code |
| `contact.altPhone` | ⚠️ *(empty)* | — |
| `contact.whatsapp` | ⚠️ `[PLACEHOLDER] +91 12345 67890` | — |
| `contact.email` | ⚠️ `[PLACEHOLDER] info@Dudhatdef.com` | Domain plausible, unverified |
| `contact.salesEmail` | ⚠️ `[PLACEHOLDER] sales@Dudhatdef.com` | — |
| `contact.website` | ⚠️ `www.Dudhatdef.com` | Unverified |
| `address.line1` | ⚠️ `[PLACEHOLDER] Plot No. ___` | Placeholder in current code |
| `address.line2` | ⚠️ `[PLACEHOLDER] MIDC` | — |
| `address.city` | ⚠️ `[PLACEHOLDER]` | — |
| `address.state` | Maharashtra | From current code |
| `address.pincode` | ⚠️ `[PLACEHOLDER]` | — |
| `address.country` | India | Real |
| `address.latitude` / `longitude` | ⚠️ `null` | Must stay null — see below |
| `social.*` | ⚠️ `null` for all five | Current links point to `/` |

**`latitude`/`longitude` stay `null`, not zeroed.** A `0,0` coordinate is a real location in the Atlantic, and `LocalBusiness` schema emitting it is worse than emitting nothing. The SEO layer omits `LocalBusiness` entirely while these are null ([SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §5).

**Social links stay `null`, not `"#"`.** Null renders no icon; `"#"` renders a dead icon. The current footer has four dead social links — the seed does not reproduce that defect.

---

## 3. Product Seed — Dudhat DEF

One product, four variants. Values below marked ⚠️ are placeholders pending a real Certificate of Analysis.

### Identity

| Field | Value | Status |
|---|---|---|
| `name` | Dudhat DEF | Real |
| `slug` | `Dudhat-def` | Real |
| `sku` | `DDEF` | Provisional |
| `tagline` | ⚠️ `[PLACEHOLDER] 32.5% High Purity Diesel Exhaust Fluid` | Concentration unverified |
| `shortDescription` | High quality Diesel Exhaust Fluid (DEF) for reduced emissions and better engine performance. | Real — from `Home.jsx` |
| `categoryId` | → `diesel-exhaust-fluid` | — |

### Specifications ⚠️ — all placeholder

These are **ISO 22241-1 published limits**, not Dudhat test results. They are seeded so the spec table renders and the editor has realistic data to work with. Every row carries `isPlaceholder: true`.

| Group | Label | Value | Unit | Standard |
|---|---|---|---|---|
| Chemical | Urea Concentration | 31.8 – 33.2 | % by weight | ISO 22241-2 |
| Chemical | Alkalinity as NH₃ | Max 0.2 | % | ISO 22241-2 |
| Chemical | Biuret | Max 0.3 | % | ISO 22241-2 |
| Chemical | Aldehydes | Max 5 | mg/kg | ISO 22241-2 |
| Chemical | Insoluble Matter | Max 20 | mg/kg | ISO 22241-2 |
| Chemical | Phosphate (PO₄) | Max 0.5 | mg/kg | ISO 22241-2 |
| Physical | Density @ 20 °C | 1.087 – 1.093 | g/cm³ | ISO 22241-2 |
| Physical | Refractive Index @ 20 °C | 1.3814 – 1.3843 | — | ISO 22241-2 |
| Physical | Appearance | Clear, colourless | — | Visual |
| Storage | Shelf Life | 18 | months | ISO 22241-3 |
| Storage | Storage Temperature | −5 to +25 | °C | ISO 22241-3 |

**What must be replaced:** every `value` column, from the CoA. The `label`, `unit`, and `standard` columns are structural and will not change.

### Badges ⚠️

`[PLACEHOLDER] ISO 22241` · `[PLACEHOLDER] 99.9% Purity` · `18 Months Shelf Life` · `Engine Safe`

The first two are compliance claims currently asserted in `Products.jsx` feature cards. They need a certificate reference before publication.

### Packaging variants — real

Derived from product titles, not from the corrupted `subtitle` field ([PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §2).

| label | slug | volume | unit | containerType | sku | image |
|---|---|---|---|---|---|---|
| 10L Can | `10l-can` | 10 | L | can | DDEF-10L | `products/can-10l.png` |
| 20L Can | `20l-can` | 20 | L | can | DDEF-20L | `products/can-20l.png` |
| 210L Drum | `210l-drum` | 210 | L | drum | DDEF-210L | `products/drum-210l.png` |
| 1000L IBC Tank | `1000l-ibc` | 1000 | L | ibc | DDEF-1000L | `products/ibc-1000l.png` |

`material`, `dimensions`, `grossWeight`, `unitsPerPallet`, `moq` are left **empty rather than guessed**. An absent logistics field renders nothing; a wrong one is quoted back by a procurement buyer.

Variant `features` (real, from `Packaging.jsx`): `Leak Proof` · `Easy to Store` · `Tamper Proof Cap` · `100% Recyclable`

### Applications — real

`Trucks & Buses` · `Construction Equipment` · `Agricultural Machinery` · `Generators & Gensets` · `Fleet Operations`

---

## 4. Category Seed

| Field | Value |
|---|---|
| `name` | Diesel Exhaust Fluid |
| `slug` | `diesel-exhaust-fluid` |
| `description` | ⚠️ `[PLACEHOLDER]` |
| `status` | `published` |

One category only. See [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) §5.

---

## 5. Admin User Seed

| Field | Value |
|---|---|
| `name` | Administrator |
| `email` | `admin@Dudhatdef.com` |
| `role` | `superadmin` |
| `password` | **Not seeded** |

The seed script creates the account in a pending state and prints a one-time set-password link. It does **not** set a default password — a seeded `admin/admin123` that survives to production is one of the most common ways an admin panel is compromised, and it survives precisely because it works.

---

## 6. Replacement Checklist

Work through before the launch gate. Each row is a business input, not an engineering task.

| # | Item | Needed from | Blocks |
|---|---|---|---|
| 1 | Certificate of Analysis — all spec values | Lab / QA | Product publish |
| 2 | ISO 22241 certificate reference | QA | `ISO 22241` badge |
| 3 | Purity figure substantiation | QA | `99.9% Purity` badge |
| 4 | Registered address + pincode | Business | `LocalBusiness` schema, footer, contact page |
| 5 | Phone, WhatsApp, alt phone | Business | All CTAs |
| 6 | Confirmed email addresses | Business | Lead notifications |
| 7 | Social profile URLs | Marketing | Footer icons, `Organization` schema |
| 8 | Geo coordinates | Business | Local SEO |
| 9 | Confirm 32.5% concentration | QA | Tagline, meta description |
| 10 | Packaging logistics data | Operations | Variant detail (optional) |

Items 1–3 share a source and should be requested together. Item 1 has the longest external turnaround and is the most likely critical path ([IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) §9).
