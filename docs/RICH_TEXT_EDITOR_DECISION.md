# Rich Text Editor Decision

> Decision record for the editor behind `Product.description` and the CMS `richText` section type.
> Resolves [SECURITY_TODO.md](SECURITY_TODO.md) S2, which must be settled **before** S1 so the allowlist is fixed first.
> Status: **Decided — Tiptap.** No implementation yet.

---

## 1. The Constraint That Decides This

[SECURITY_TODO.md](SECURITY_TODO.md) S2 states the failure mode plainly:

> The risk here is choosing an editor whose output shape fights the allowlist — for example one that emits inline `style` attributes or wraps content in `div`s — and then widening the allowlist to accommodate it. **Widening the allowlist to suit a tool is how this becomes an incident.**

So the primary criterion is not features or polish. It is: **can the editor be constrained so it cannot emit anything outside the allowlist in the first place?**

An editor that produces `<span style="…">` and relies on the sanitiser to strip it creates a permanent mismatch — what the author sees is not what gets stored. That pressure eventually resolves by widening the allowlist.

---

## 2. Comparison

Licences and versions verified against the npm registry, not recalled.

| | **Tiptap** | **Quill** | **CKEditor 5** | **TinyMCE** |
|---|---|---|---|---|
| Version | 3.29.2 | 2.0.3 | 48.3.1 | 8.8.2 |
| Licence | **MIT** | BSD-3-Clause | `SEE LICENSE` — GPL-2.0+ **or commercial** | `SEE LICENSE` — GPL-2.0+ **or commercial** |
| Constrainable output | **Yes — schema-driven** | Partial (`formats` option) | Yes (schema) | Partial (`valid_elements`) |
| Default output cleanliness | Semantic HTML, no inline styles | Emits `ql-*` classes and inline styles for some formats | Clean, but rich by default | Rich; inline styles common |
| React 19 support | **Official, current** | **Broken** — see below | Official | Official |
| Approx. bundle (gzipped) | ~45–70 KB for our extension set | ~43 KB | ~200 KB+ | ~300 KB+ |
| Last publish | 2026-07-28 | 2025-01-20 | current | current |
| Maintenance | Active, ProseMirror foundation | Active again since v2 | Corporate | Corporate |

### Disqualifying findings

**Quill — the React integration is dead for our stack.** `react-quill` declares peer dependencies of `react: ^16 || ^17 || ^18`. This project is on **React 19**. It last published **2023-09-24**, over two years ago, and does not support Quill 2. Adopting Quill means `--legacy-peer-deps`, a community fork, or hand-writing a wrapper around a Delta-based editor whose internal model is not HTML. Quill also stores Deltas natively; HTML is a conversion, so the stored format is not the editor's source of truth.

**CKEditor 5 and TinyMCE — licence.** Both publish as GPL-2.0-or-later *or* commercial. GPL is viral: using it in a proprietary commercial site means either licensing the site under GPL or buying a commercial licence. The brief was "best in category and mostly free"; these are free only if the project accepts GPL obligations. Both are also 3–6× the bundle size of the alternatives, for capability this project does not need.

Neither is *bad software* — CKEditor 5's schema model is genuinely comparable to Tiptap's. The licence is what rules them out here.

---

## 3. Recommendation — Tiptap

Agreed with the stated preference, for these reasons:

1. **The allowlist becomes the editor configuration.** Tiptap is headless and schema-driven on ProseMirror. An extension that is not installed cannot produce its node — there is no `Image` node unless `@tiptap/extension-image` is registered, so the editor is *incapable* of emitting `<img>`. The allowlist stops being a filter applied after the fact and becomes a structural property. This is exactly what S2 asks for.

2. **MIT throughout.** Every extension needed for our allowlist verified MIT: `@tiptap/core`, `@tiptap/react`, `extension-bold`, `-italic`, `-underline`, `-bullet-list`, `-ordered-list`, `-heading`, `-blockquote`, `-link`. No GPL obligation, no commercial licence.

3. **Zero cost to the public site.** Tiptap ships only in `admin/`. The public site renders stored HTML — it never loads an editor. The bundle comparison above is an admin-only concern, and the public site's Core Web Vitals budget is untouched.

4. **Clean default output.** Semantic tags, no inline styles, no wrapper `div`s, no framework classes.

### Honest caveats

**Tiptap has a paid tier.** Collaboration, comments, AI, drag handles, table of contents and the hosted sync service are Pro/paid. **None of them is needed here**, and the free extensions cover the entire allowlist. But if someone later wants collaborative editing, that is a paid conversation — worth knowing now rather than discovering mid-sprint.

**ProseMirror has a real learning curve.** Tiptap hides most of it, but non-trivial schema debugging means understanding ProseMirror's document model. That is a genuine cost against Quill's simpler API, accepted because the schema is precisely the property we are buying.

**Headless means building the toolbar.** No default UI. For a constrained allowlist that is a small amount of work and gives exact control over which controls exist — a toolbar with no image button is one more layer preventing content the allowlist forbids.

---

## 4. Allowed HTML Tags

The allowlist from [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §6, unchanged. The editor is configured to match it — **the allowlist is not widened to suit the tool.**

| Tag | Tiptap extension | Purpose |
|---|---|---|
| `p` | Paragraph (core) | Body text |
| `br` | HardBreak | Line break |
| `strong` | Bold | Emphasis |
| `em` | Italic | Emphasis |
| `u` | Underline | Emphasis |
| `ul` | BulletList | List |
| `ol` | OrderedList | List |
| `li` | ListItem | List item |
| `a` | Link | Link |
| `h2` `h3` `h4` | Heading (levels 2–4 only) | Structure |
| `blockquote` | Blockquote | Quotation |

**Explicitly excluded, and why:**

- `h1` — the page owns exactly one `<h1>`. Letting body content emit another breaks the heading hierarchy that Phase 0 fixed across all eight pages.
- `img` — images belong in the media library with `alt`, dimensions and `usageCount` tracking. An `<img>` pasted into prose has none of that and would bypass the delete guard.
- `script`, `style`, `iframe`, `object`, `embed`, `form`, `input` — direct execution or injection vectors.
- `div`, `span` — structural noise with no semantic value; their usual purpose is carrying a `style` or `class`.
- `table` — not needed for product copy. Specifications are structured data in `specifications[]`, not prose.

---

## 5. Allowed Attributes

**Default: none.** Every tag above carries no attributes except where listed.

| Tag | Attribute | Constraint |
|---|---|---|
| `a` | `href` | Schemes limited to `http`, `https`, `mailto`, `tel`. Everything else dropped |
| `a` | `title` | Plain text |
| `a` | `rel` | Forced to `noopener noreferrer nofollow` on write — not accepted from input |
| `a` | `target` | Forced to `_blank`; not accepted from input |

**Never allowed on any tag:** `style`, `class`, `id`, `on*` handlers, `data-*`, `srcset`, `formaction`.

`class` is worth calling out. It is tempting for styling, and it is how `ql-*` classes would arrive from Quill. Excluding it means stored content carries no presentation — the public site styles `.rich-text > p` etc. from its own stylesheet. Content stays presentation-free, which is also what makes it safe to restyle later without a migration.

`javascript:`, `data:` and `vbscript:` URLs are dropped by the scheme restriction. This is the single most important attribute rule: `<a href="javascript:…">` is the classic bypass of a tag-only allowlist.

---

## 6. Sanitisation Strategy

### Server-side is the control. Client-side is not.

Tiptap's schema constrains what the **editor** can produce. It does nothing about a request posted directly to `PUT /admin/products/:id` with a crafted body. An `editor`-role user — or anyone with a stolen editor session — can do that trivially.

So: **sanitise on write, in `product.service`, before persistence.** Per [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §6, sanitising on write rather than on render means the database never holds an attack payload, so a future consumer that forgets to escape is not immediately vulnerable.

### Library: `sanitize-html` (MIT, 2.17.6)

Chosen over DOMPurify + `jsdom`:

- Purpose-built for server-side allowlisting; its config **is** an allowlist, mapping directly onto §4 and §5 above.
- Pure JS, no native build step. This environment has already broken two packages on native/ESM issues (esbuild, ts-node), so a dependency with no build step is worth real weight.
- `jsdom` is a multi-megabyte dependency and a large parsing surface to run on every product save.

**The trade-off, stated honestly:** DOMPurify is the more adversarially-hardened sanitiser, particularly against mXSS and namespace-confusion attacks. Those classes matter most when the allowlist permits SVG, MathML, `style`, or `data-*`. Ours permits none of them, so the attack surface `sanitize-html` must cover is small and well-defined.

**Escalation condition:** if the allowlist is ever widened to include SVG, MathML, `style`, or arbitrary attributes, switch to DOMPurify + jsdom in the same change. Do not widen the allowlist and keep the lighter sanitiser.

### Rules

1. Sanitise in the **service layer**, never the controller or the model.
2. Sanitise on **every** write path — create, update, duplicate, and any future import.
3. **Backfill existing rows** through the same sanitiser when this ships. There are currently zero rows, which makes it free today and expensive later.
4. Reject nothing on the basis of sanitisation — strip silently. A user who pasted from Word should not get an error; they should get clean output.
5. Sanitiser output is **stored**, so what the editor shows after a reload is exactly what was kept. No drift between authored and stored content.
6. One shared sanitiser module, used by `Product.description` and the future `richText` section. Two implementations become two allowlists.

---

## 7. Rendering Strategy

### Public site

Content is **prerendered at build time** ([SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §2), so the HTML must be in the static output. It is fetched from the API — already sanitised — and injected.

- Rendered through **one** wrapper component, `<RichText html={…} />`, which is the only place in the codebase permitted to use `dangerouslySetInnerHTML`.
- That component is the review chokepoint: any change to it is a security change.
- Styling comes from a `.rich-text` scope in the site's own stylesheet, since stored content carries no `class`.
- **Tiptap never ships to the public site.** No editor code in the public bundle.

### Admin

- The editor renders the document from stored HTML via Tiptap's schema, which discards anything the schema does not recognise — a second, independent filter.
- The product preview uses the **same** `<RichText />` wrapper, so preview and live output cannot diverge.

### Defence in depth

CSP ([SECURITY_TODO.md](SECURITY_TODO.md) S7) is the backstop if sanitisation is ever wrong. It is not a substitute: `script-src 'self'` does not stop `<a href="javascript:…">`, which is why the scheme restriction in §5 is a primary control rather than a nicety.

---

## 8. Security Implications Summary

| Layer | Control | Primary or defence-in-depth |
|---|---|---|
| Editor schema | Cannot produce non-allowlisted nodes | Defence in depth (bypassed by direct API call) |
| Toolbar | No control for excluded formats | Defence in depth |
| Request validator | Length cap (20 000 chars) | Primary — bounds payload size |
| **Service sanitiser** | **Tag + attribute + URL-scheme allowlist on write** | **Primary** |
| Database | Stores only sanitised HTML | Consequence of the above |
| Render wrapper | Single `dangerouslySetInnerHTML` site | Primary — limits the blast radius to one reviewed file |
| CSP | Blocks inline script execution | Defence in depth |

**The one that matters is the service sanitiser.** Everything else narrows the path to it or limits the damage if it fails.

---

## 9. Open Items Before Implementation

1. **Round-trip test is mandatory**, not optional: author hostile input (`<script>`, `<img onerror>`, `<a href="javascript:…">`, `<a href="data:text/html,…">`, style attributes, nested markup) and assert the **stored** value is clean. Testing that the editor refuses to show it is not the same test — the threat model is a direct API post.
2. **`<u>` is semantically weak.** HTML5 defines `<u>` as an unarticulated annotation, and on the web underline reads as a link. It is in the allowlist because it was already specified; worth removing if the editors do not actually need it.
3. **Paste handling.** Tiptap's schema filters pasted content automatically. Confirm behaviour when pasting from Word and Google Docs, which is where `style` attributes and `<span>` soup usually enter.

---

## 10. Decision

**Tiptap**, with `sanitize-html` server-side, the allowlist in §4–§5 unchanged from [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §6.

Ships in Phase 2F **in the same change as S1** — the product editor is the first surface that renders `description`, so the sanitiser cannot follow it.
