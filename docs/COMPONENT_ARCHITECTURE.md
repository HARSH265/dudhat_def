# Component Architecture

> Status: Planning document. No code written yet.
> Scope: Frontend component structure for the public site (`client/`) and the shared conventions the admin app inherits.
> Related: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [ARCHITECTURE.md](ARCHITECTURE.md), [CLAUDE_RULES.md](CLAUDE_RULES.md), [API_SPECIFICATION.md](API_SPECIFICATION.md)

---

## 0. Design Freeze — Constraints On This Document

The existing design is approved and frozen ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) § Design Freeze). Every restructure below must be **visually identical** to what ships today. Three items in the original draft of this document violated that and are corrected here:

| Original proposal | Status | Reason |
|---|---|---|
| Tailwind migration (§8) | **Dropped** for the public site | A rewrite of 888 lines of working CSS risks visual regression on every page for zero user-visible gain. Styling stays `variables.css` tokens + CSS Modules. Tailwind remains admin-only. |
| `layout/FloatingCta.jsx` | **Removed** | Net-new UI element. Not in the approved design. |
| `ProductCard` secondary "Request Quote" button | **Removed** | Net-new UI element. The fix is to wire the *existing* "View Details" button to a destination — a defect fix, not an addition. |
| `Navbar` scroll-based compact state | **Removed** | Changes rendered appearance. |
| `/products/:slug` detail page | **Gated** | Required by [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) and the lead funnel, but it is a new page. Needs design approval, and must be composed only from existing approved components and section patterns. |

Refactoring, accessibility, responsiveness, and performance work proceed without approval. Anything that changes a pixel does not.

**Verification method:** each migrated component is checked against the current build at 320 / 640 / 768 / 1024 / 1280px before merge. "Looks fine" is not a check.

---

## 1. Current State

### Inventory

**Components — 6** (`client/src/components/`)

| Component | Props | Assessment |
|---|---|---|
| `Button` | `text, to, href, type, variant, onClick` | Good. Correctly polymorphic over `Link` / `<a>` / `<button>`. Keep. |
| `FeatureCard` | `icon, title, description, variant` | Good. Used on 4 pages. Keep. |
| `ProductCard` | `image, title, subtitle, buttonText` | Incomplete — no link, no click handler. The "View Details" button does nothing. |
| `ContactForm` | none | Does too much: state, validation, HTTP, and presentation in one file. |
| `Navbar` | none | Hardcoded link array. |
| `Footer` | none | Hardcoded links, products, contact details, social URLs (all pointing at `/`). |

**Pages — 8** (`client/src/pages/`): Home, About, Products, WhyDef, Quality, Packaging, Sustainability, Contact.

**Styling:** two global stylesheets — `variables.css` (well-structured design tokens) and `App.css` (888 lines, ~71 flat global classes).

### Problems

1. **Content is hardcoded in components.** Every page holds its content in a local array: `Home` has `features`, `Products` has `products` and `features`, `Packaging` has `packages` and `features`, `Quality` has `checklist`, `WhyDef` has `steps`, `Sustainability` has `points`, `Footer` and `Contact` hold the company's phone, email, and address. This is the direct violation of [CLAUDE_RULES.md](CLAUDE_RULES.md) — "No hardcoded content" — and it is why the CMS exists.

2. **Repeated section markup.** `About` and `Sustainability` render an identical `.about-grid` text+image layout. `Products` and `Packaging` are near-identical files: same imports, same `product-grid` + `feature-grid` composition, only the data differs. `Quality` and `WhyDef` each end with a copy-pasted `.cta-banner`. Four page-level patterns are duplicated across seven files — again a rule violation ("Never duplicate code").

3. **No layer boundaries.** There is `components/` and `pages/`, with nothing distinguishing a primitive (`Button`) from a page section (`hero`). Everything sits in one flat folder.

4. **`ProductCard` is decorative.** Its button is inert, so the product grid is a dead end — on a lead-generation site where [PROJECT_BIBLE.md](PROJECT_BIBLE.md) says every page should push toward a conversion action, this is the most expensive UI gap on the site.

5. **Data fetching inside a presentational component.** `ContactForm` imports `axios` and calls the API directly. No abstraction, no retry, no shared error handling, and swapping the transport means editing a form.

6. **No accessible form labelling.** All `ContactForm` inputs use `placeholder` as their only label. Placeholders vanish on focus and are not reliably announced by screen readers.

7. **Global CSS with no scoping.** 71 flat class names in one file; `.container`, `.section`, `.about-grid` are shared across pages by convention alone. Nothing prevents a collision.

8. **No error boundary, no 404 route, no `Suspense`.** An unknown URL renders the Navbar and Footer around an empty page.

9. **No SEO per route.** One static `<title>` in `public/index.html` for all eight routes, despite "SEO First" being a stated rule.

### Gap against the documented target

[ARCHITECTURE.md](ARCHITECTURE.md) specifies Vite, React Query, Tailwind, shadcn/ui, and Framer Motion. The app runs CRA (`react-scripts@5.0.1`) with hand-written global CSS and no data layer. Section 9 below sets out the migration; the structure in §2–§8 is designed so that migration is mechanical rather than a rewrite.

---

## 2. Target Structure

```
client/src/
├─ app/
│  ├─ App.jsx                    routes + providers
│  ├─ router.jsx                 route table (data-driven)
│  └─ providers/
│     ├─ QueryProvider.jsx
│     └─ SettingsProvider.jsx
│
├─ components/
│  ├─ ui/                        primitives — no domain knowledge
│  │  ├─ Button.jsx
│  │  ├─ Input.jsx
│  │  ├─ Textarea.jsx
│  │  ├─ Select.jsx
│  │  ├─ FormField.jsx
│  │  ├─ Card.jsx
│  │  ├─ Badge.jsx
│  │  ├─ Icon.jsx
│  │  ├─ Skeleton.jsx
│  │  ├─ Spinner.jsx
│  │  ├─ Modal.jsx
│  │  └─ Alert.jsx
│  │
│  ├─ common/                    composed, still domain-free
│  │  ├─ SectionHeading.jsx
│  │  ├─ Container.jsx
│  │  ├─ Section.jsx
│  │  ├─ ImageWithFallback.jsx
│  │  ├─ ErrorBoundary.jsx
│  │  ├─ ErrorState.jsx
│  │  ├─ EmptyState.jsx
│  │  ├─ LoadingState.jsx
│  │  └─ Seo.jsx
│  │
│  ├─ layout/
│  │  ├─ Layout.jsx
│  │  ├─ Navbar.jsx
│  │  ├─ MobileMenu.jsx          extracted from Navbar; behaviour only, same markup
│  │  ├─ Footer.jsx
│  │  └─ ScrollToTop.jsx
│  │
│  ├─ sections/                  1:1 with CMS section types
│  │  ├─ SectionRenderer.jsx
│  │  ├─ HeroSection.jsx
│  │  ├─ FeatureStripSection.jsx
│  │  ├─ TextImageSection.jsx
│  │  ├─ ChecklistSection.jsx
│  │  ├─ ProcessFlowSection.jsx
│  │  ├─ ProductGridSection.jsx
│  │  ├─ CtaBannerSection.jsx
│  │  ├─ ContactInfoSection.jsx
│  │  ├─ GallerySection.jsx
│  │  └─ RichTextSection.jsx
│  │
│  └─ features/                  domain components
│     ├─ product/
│     │  ├─ ProductCard.jsx
│     │  ├─ ProductGrid.jsx
│     │  ├─ ProductGallery.jsx
│     │  ├─ ProductSpecTable.jsx
│     │  ├─ PackagingVariants.jsx
│     │  └─ RelatedProducts.jsx
│     └─ lead/
│        ├─ ContactForm.jsx
│        ├─ QuoteRequestForm.jsx
│        ├─ CallbackForm.jsx
│        ├─ LeadFormFields.jsx
│        └─ FormSuccess.jsx
│
├─ pages/                        thin — fetch + compose only
│  ├─ HomePage.jsx
│  ├─ AboutPage.jsx
│  ├─ ProductsPage.jsx
│  ├─ ProductDetailPage.jsx
│  ├─ WhyDefPage.jsx
│  ├─ QualityPage.jsx
│  ├─ PackagingPage.jsx
│  ├─ SustainabilityPage.jsx
│  ├─ ContactPage.jsx
│  └─ NotFoundPage.jsx
│
├─ api/
│  ├─ client.js                  axios instance: baseURL, timeout, interceptors
│  ├─ pages.api.js
│  ├─ products.api.js
│  ├─ leads.api.js
│  └─ settings.api.js
│
├─ hooks/
│  ├─ usePage.js
│  ├─ useProducts.js
│  ├─ useProduct.js
│  ├─ useSettings.js
│  ├─ useSubmitLead.js
│  ├─ useMediaQuery.js
│  └─ useScrollLock.js
│
├─ lib/
│  ├─ queryKeys.js
│  ├─ validators.js
│  ├─ formatters.js
│  ├─ analytics.js
│  └─ constants.js
│
└─ styles/
   ├─ variables.css              design tokens — keep as-is
   └─ global.css                 reset + base only
```

---

## 3. Layer Rules

Five layers, with a strict one-way dependency direction.

```
pages  →  sections  →  features  →  common  →  ui
                            ↓
                         hooks → api
```

| Layer | May import | Must not |
|---|---|---|
| `ui` | nothing but React + icons | know about products, leads, or the API |
| `common` | `ui` | fetch data, know domain concepts |
| `features` | `ui`, `common`, `hooks`, `lib` | import from `pages` or `sections` |
| `sections` | `ui`, `common`, `features` | fetch its own data — it receives `data` as a prop |
| `pages` | everything | contain markup beyond composition |
| `hooks` | `api`, `lib` | render anything |
| `api` | `lib` | know about React |

**Enforcement:** ESLint `import/no-restricted-paths` with one rule per boundary. A convention nobody can violate accidentally is worth more than one written down.

### Where data fetching lives

Only `pages` and `features` fetch. `sections` and everything below are pure — they take props and render. This is what makes the CMS renderer possible: a section component never knows whether its content came from an API, a fixture, or Storybook.

---

## 4. Component Contracts

### 4.1 `ui/Button`

The existing `Button` is already the right shape. Extend rather than replace.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `children` | node | — | Replaces `text` — allows icons; `text` kept as a deprecated alias for one release |
| `to` | string | — | Renders `<Link>` |
| `href` | string | — | Renders `<a>`; external links get `rel="noopener noreferrer"` |
| `type` | `button` \| `submit` | `button` | |
| `variant` | `primary` \| `outline` \| `ghost` \| `danger` | `primary` | |
| `size` | `sm` \| `md` \| `lg` | `md` | |
| `isLoading` | bool | `false` | Shows a spinner, disables, keeps width stable |
| `disabled` | bool | `false` | |
| `iconLeft` / `iconRight` | component | — | |
| `fullWidth` | bool | `false` | |
| `onClick` | fn | — | |

Precedence stays as built: `to` → `href` → `<button>`.

### 4.2 `features/product/ProductCard`

Fixes the dead button.

| Prop | Type | Required | Notes |
|---|---|---|---|
| `product` | object | yes | `{ slug, name, shortDescription, primaryImage, badges, packaging }` |
| `buttonText` | string | no | Default `"View Details"` — unchanged from today |
| `variant` | `default` \| `compact` | no | |

Behaviour: the existing "View Details" button becomes a `Link` to `/products/:slug`. That is the whole change — the card's markup, classes, and appearance are untouched. Today the button renders and does nothing, which is a defect, not a design decision.

No second button is added. Adding a "Request Quote" CTA to the card was proposed and is **withdrawn** under the design freeze (§0); if the business wants it, it goes through design approval first.

Passing a whole `product` object rather than flattened props means adding a field to the model does not change the component's signature. Prop-drilling `image, title, subtitle` (the current design) forces an edit at every call site.

### 4.3 `features/lead/*`

`ContactForm` splits into four pieces:

| Piece | Responsibility |
|---|---|
| `LeadFormFields` | Presentational fields only — receives `values`, `errors`, `onChange` |
| `ContactForm` | Full form (name, email, phone, company, message) |
| `QuoteRequestForm` | Adds product + quantity; used in the modal from `ProductCard` |
| `CallbackForm` | Name + phone only; used in the floating CTA |
| `useSubmitLead` | The React Query mutation — the only place that talks to the API |
| `FormSuccess` | Shared confirmation state |

All three forms include the honeypot field described in [API_SPECIFICATION.md](API_SPECIFICATION.md) §4.3 — a visually hidden `website` input that must stay empty.

**Accessibility fix:** every input gets a real `<label>` via `ui/FormField`, which pairs label, control, hint, and error with `htmlFor` / `aria-describedby` / `aria-invalid`. Placeholders become examples, not labels.

**Validation:** shared rules in `lib/validators.js`, mirroring the server-side schema field-for-field, run on blur and on submit. Client validation is UX; the server remains the authority.

### 4.4 `layout/Navbar` and `layout/Footer`

Both currently hold hardcoded arrays. Both become consumers of `useSettings()` and the `/api/v1/navigation` endpoint, with the current arrays kept as a static fallback so the shell renders even if the API is unreachable. A marketing site that shows nothing when the CMS is down is worse than one showing slightly stale links.

`Navbar` additionally gains `MobileMenu` as an extraction — currently a CSS class toggle with no focus trap, no `aria-expanded`, no body scroll lock, and no route-change auto-close. All four are behavioural fixes; the menu's markup and appearance do not change. The previously proposed scroll-based compact header is withdrawn under §0.

---

## 5. Page Composition

Pages become thin. Each fetches its CMS document and hands the sections to the renderer.

```
HomePage
  ├─ Seo                        from page.seo
  └─ SectionRenderer            page.sections
       ├─ HeroSection
       ├─ FeatureStripSection
       ├─ ProductGridSection    ← fetches featured products itself
       └─ CtaBannerSection
```

Mapping of today's hardcoded pages onto section types:

| Page | Sections | Currently hardcoded as |
|---|---|---|
| Home | `hero`, `featureStrip` | `heroBg` + inline copy; `features[]` |
| About | `textImage`, `featureStrip` | `.about-grid` + `features[]` |
| Products | `productGrid`, `featureStrip` | `products[]` + `features[]` |
| Why DEF | `processFlow`, `ctaBanner` | `steps[]` + inline banner |
| Quality | `textImage`, `checklist`, `ctaBanner` | `checklist[]` + inline banner |
| Packaging | `productGrid`, `featureStrip` | `packages[]` + `features[]` |
| Sustainability | `textImage`, `featureStrip` | `points[]` |
| Contact | `contactInfo`, form | Inline contact details |

`About` and `Sustainability` collapse onto one `TextImageSection`. `Products` and `Packaging` collapse onto one `ProductGridSection` with different filters. `Quality` and `WhyDef` share one `CtaBannerSection`. Seven near-duplicate page files become eight thin pages plus ten reusable sections.

**New route:** `/products/:slug` — a product detail page. The catalogue currently has no destination, which is the missing half of the conversion funnel.

---

## 6. Section Renderer

The bridge between the CMS and the UI.

```
SectionRenderer({ sections })
  → for each section, ordered by `order`, skipping `isVisible: false`
    → look up section.type in the registry
    → render <Component data={section.data} />
    → unknown type → render nothing in production, a visible warning in development
```

The registry is a plain object mapping `type` → component. Adding a section type means adding one component and one registry entry — no change to any page, and no change to `SectionRenderer`.

**Contract:** every section component takes exactly `{ data }` plus optional `className`. It never fetches, never reads global state, and never knows its position. `ProductGridSection` is the one permitted exception: it fetches products via `useProducts()` from a filter spec in its `data`, because embedding a product list into page content would go stale the moment a product changes.

Each section component defines its own `data` PropTypes, mirroring the server-side validator in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.6. The two must be kept in step; once the TypeScript migration lands, both generate from one shared schema.

---

## 7. Data Layer

Per [ARCHITECTURE.md](ARCHITECTURE.md), React Query is the target.

### `api/client.js`

One axios instance. `baseURL` from `REACT_APP_API_URL` (later `VITE_API_URL`), 15s timeout, JSON headers, a response interceptor that unwraps the `{ success, message, data }` envelope and normalises errors into a single `ApiError` shape `{ message, errorCode, errors, status }`.

Components never see the envelope and never see an axios error. Today `ContactForm` reaches into `error.response?.data?.message` inline — that knowledge belongs in one interceptor, not in every component.

### Query keys — `lib/queryKeys.js`

```
settings                          ['settings']
navigation                        ['navigation']
page(key)                         ['page', key]
products(filters)                 ['products', filters]
product(slug)                     ['product', slug]
relatedProducts(slug)             ['product', slug, 'related']
categories()                      ['categories']
```

Centralised so invalidation is never guessed at.

### Hooks

| Hook | Wraps | staleTime |
|---|---|---|
| `useSettings()` | `GET /settings` | 10 min |
| `usePage(key)` | `GET /pages/:key` | 5 min |
| `useProducts(filters)` | `GET /products` | 5 min |
| `useProduct(slug)` | `GET /products/:slug` | 5 min |
| `useSubmitLead()` | `POST /leads` | mutation |

Defaults: `retry: 2` with exponential backoff on queries, **`retry: 0` on the lead mutation** — a retried POST can create duplicate leads, and a duplicate lead costs a sales conversation.

`refetchOnWindowFocus: false` for content — marketing copy does not change while a visitor reads it, and needless refetches cost mobile data.

### `useSubmitLead`

`onSuccess`: reset the form, show `FormSuccess`, fire an analytics conversion event, and — for a product inquiry — invalidate that product's query so `inquiryCount` refreshes.
`onError`: surface `error.message` verbatim; the API guarantees it is user-safe.
Throughout: the submit button is disabled and `isLoading`, preventing double-submits (which the current form allows on a slow connection).

---

## 8. Styling

### Tokens stay

`variables.css` is the best-designed file in the project — a coherent set of colour, typography, spacing, radius, shadow, and transition tokens. It survives the Tailwind migration intact: the tokens become the Tailwind theme, so `--color-navy` becomes `theme.colors.navy` and the brand stays consistent through the migration rather than being re-picked from screenshots.

Additions needed: a spacing scale (currently only `--section-padding` exists), a type scale, breakpoint variables, and z-index layers.

### CSS Modules migration (replaces the dropped Tailwind plan)

Per §0, Tailwind is not used on the public site. The goal is scoping and maintainability, not a new styling language.

1. Each component gains a `Component.module.css` alongside it.
2. Its rules are **moved verbatim** from `App.css` — copied, not rewritten. Declarations stay byte-identical so the rendered result cannot drift.
3. The class is renamed only at the boundary (`.product-card` → `styles.card`); the CSS body is untouched.
4. `App.css` shrinks block by block. What remains at the end is genuinely global (`.container`, `.section`) and moves to `global.css`.

This gets the maintainability win — scoped styles, no collisions, styles co-located with components — with a near-zero regression surface, because no declaration is ever re-authored.

### Responsive rewrite

The only CSS that *is* re-authored. Current state per [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): 9 `max-width` queries across 6 ad-hoc breakpoints, desktop-first, with `!important` at `App.css:551` and `App.css:599`.

Per component, as it moves to CSS Modules: invert to `min-width`, snap to the canonical 640/768/1024/1280 scale, remove the `!important` pairs by fixing the underlying specificity, and unify the 1300px/1400px container split to 1300px. Verified at all five widths against the current build.

### Rules

- No inline `style` except for genuinely dynamic values (background image URLs, computed transforms). `Sustainability.jsx` currently uses `style={{ marginTop: "50px" }}` — that becomes a class.
- No magic numbers; spacing comes from the scale.
- Mobile-first breakpoints, matching [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): base → `sm 640` → `md 768` → `lg 1024` → `xl 1280`.
- One component owns its styles; no reaching into a child's classes.

### Animation

[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) asks for fast, smooth, professional motion and explicitly forbids flashy effects. Framer Motion is used only for: section fade-up on scroll (200ms, once, 20px), mobile menu slide (250ms), modal fade+scale (150ms), and button/card hover (CSS, 150ms).

Every animation respects `prefers-reduced-motion`, and no animation gates content visibility — text is in the DOM and readable whether or not the animation runs. Motion that hides content until JavaScript settles costs both accessibility and LCP.

---

## 9. Migration Plan

Ordered so each step ships independently and nothing is left half-migrated.

| Step | Work | Risk |
|---|---|---|
| 1 | Add `api/client.js`, React Query provider, `queryKeys`. Nothing consumes them yet | none |
| 2 | Add `ErrorBoundary`, `NotFoundPage`, `ScrollToTop`, `Seo` | low |
| 3 | Fix `ProductCard` — make the existing button link to `/products/:slug` | low |
| 4 | Extract `FormField`; rebuild `ContactForm` on `useSubmitLead` with real labels | medium — touches the live conversion path, test carefully |
| 5 | Introduce `sections/`, port the four duplicated patterns, rebuild pages as compositions with content still hardcoded in fixtures | medium |
| 6 | Swap fixtures for `usePage()` — content moves to the CMS | medium |
| 7 | `Navbar`/`Footer` read from `useSettings()` with static fallback | low |
| 8 | Add `/products/:slug` and the product detail components | low |
| 9 | CRA → Vite | medium — build config only, no component changes |
| 10 | CSS Modules + responsive rewrite, incrementally per §8 | low per component, long tail |

**Step 4 is the one to be careful with.** It is the only step that touches a working conversion path, and a broken contact form means lost leads, silently. It ships with the legacy endpoint alias intact ([API_SPECIFICATION.md](API_SPECIFICATION.md) §9) so a rollback is a client-side revert with no server change.

Steps 1–3 and 7 are safe to do at any time and deliver value before the CMS exists.

---

## 10. Conventions

| Concern | Rule |
|---|---|
| File naming | `PascalCase.jsx` for components, `camelCase.js` for everything else |
| Exports | One default export per component file; named exports for hooks and utilities |
| Props | Destructured in the signature, with defaults inline |
| Types | PropTypes now, TypeScript after the Vite migration |
| Conditional render | `condition ? <X /> : null` — never `&&` with a number (renders `0`) |
| Lists | Stable IDs as keys. The current pages use array index; acceptable for static arrays, unacceptable once the CMS makes lists reorderable |
| Images | Always `alt`; always `width`/`height` to prevent CLS; `loading="lazy"` below the fold; `fetchpriority="high"` on the hero |
| Icons | Through `ui/Icon` so the icon library stays swappable |
| Text | Never hardcoded in a component — from CMS, settings, or `lib/constants.js` |
| Dead code | No commented-out blocks; git holds the history |

### Definition of done for a new component

1. Sits in the right layer and imports only downward.
2. Props documented with PropTypes and sensible defaults.
3. Handles loading, empty, and error states where it can encounter them.
4. Keyboard-operable with a visible focus ring.
5. Works from 320px up.
6. No hardcoded content.
7. No duplicated markup that an existing component already provides.

That last point is the one most likely to be skipped, and it is the reason `Products.jsx` and `Packaging.jsx` are the same file twice.
