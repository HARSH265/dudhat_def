# Phase 2F Review — CMS Admin UI + S1 Sanitisation

> **HISTORICAL.** Findings recorded. Kept for the record.
> Do not read for current state — see [PROJECT_STATUS.md](PROJECT_STATUS.md).

> Scope: media library, product editor, categories, SEO panel, profile, change-password UI, and SECURITY_TODO S1.
> Method: typecheck, production build, and behavioural testing against live Atlas and the real Cloudinary account.
> Public site untouched — no file under `client/` was modified in this phase.

---

## 1. The Allowlist (generated before implementation, as required)

Single source of truth: `server/src/utils/richText.ts`. One module for every rich-text field — two implementations would become two allowlists.

### Tags — 13

`p` · `br` · `strong` · `em` · `u` · `ul` · `ol` · `li` · `a` · `h2` · `h3` · `h4` · `blockquote`

**Excluded, with reasons:**

| Excluded | Why |
|---|---|
| `h1` | The page owns exactly one. Body copy emitting another breaks the heading hierarchy Phase 0 fixed across all eight pages |
| `img` | Images belong in the media library with alt text, dimensions and `usageCount`. An `<img>` in prose has none of that and bypasses the delete guard |
| `div`, `span` | Structural noise whose usual purpose is carrying `style` or `class` |
| `table` | Specifications are structured data in `specifications[]`, not prose |
| `script`, `style`, `iframe`, `object`, `embed`, `form`, `input` | Direct execution or injection vectors |

### Attributes

Default: **none**. Only `a` carries any.

| Tag | Attribute | Constraint |
|---|---|---|
| `a` | `href` | Schemes limited to `http`, `https`, `mailto`, `tel` |
| `a` | `title` | Plain text |
| `a` | `rel` | **Forced** to `noopener noreferrer nofollow` — not accepted from input |
| `a` | `target` | **Forced** to `_blank` — not accepted from input |

Never allowed anywhere: `style`, `class`, `id`, `on*`, `data-*`, `srcset`, `formaction`.

### Sanitisation rules

1. **On write, in the service layer** — create, update *and* duplicate. Never on render. The database never holds a payload, so a future consumer that forgets to escape is not immediately vulnerable.
2. **Strip silently, never reject.** Someone pasting from Word gets clean output, not a validation error they cannot act on.
3. **Protocol-relative URLs rejected** (`allowProtocolRelative: false`). `//evil.example` inherits the page scheme and would otherwise escape the scheme allowlist entirely.
4. **`disallowedTagsMode: "discard"`** — an empty document is empty, not a page of visible escaped markup.
5. **Stripping is logged** at `warn`, so a spike is visible rather than silent.
6. **Backfill provided** — `npm run backfill:sanitize`, idempotent, dry-run by default.

**The allowlist was not widened to fit Tiptap.** Tiptap was configured down to match it: `codeBlock`, `code`, `horizontalRule` and `strike` are explicitly disabled, headings restricted to 2–4.

---

## 2. Verification

### S1 — hostile input, through the live API

Posted directly to `POST /admin/products`, bypassing the editor entirely — which is the actual threat model.

| Input | Stored |
|---|---|
| `<script>alert(1)</script>` | removed |
| `<img src=x onerror=alert(1)>` | removed |
| `<a href="javascript:alert(1)">` | `href` dropped, text kept |
| `<a href="jAvAsCrIpT:…">` | `href` dropped |
| `<a href="data:text/html,…">` | `href` dropped |
| `<a href="//evil.example">` | `href` dropped |
| `<p style="position:fixed">` | attribute dropped |
| `<p class="ql-align-center">` | attribute dropped |
| `<iframe>`, `<svg onload>` | removed |
| `<h1>H1</h1>` | tag discarded, text kept |
| `<div><span style=…>` (Word paste) | unwrapped to text |
| `<a href="https://ok" rel="" target="_self">` | `rel`/`target` forced back |
| Legitimate `<p><strong><a><ul>` | preserved intact |

Verified again on the **update** path, and the **duplicate** path sanitises rather than laundering an unsanitised row forward.

### Everything else

| Area | Result |
|---|---|
| Typecheck (server + admin) | Clean under `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Production build | Clean, no warnings |
| Backfill script | Idempotent — "No changes, all descriptions already clean" |
| Seeded leads | **All 4 preserved and untouched** |
| Media `usageCount` | Decremented correctly when test products were removed |

---

## 3. Bug Found During This Phase

**The backfill script hit MONGOOSE_GOTCHAS §1 within a day of that document being written.**

`Product.find({ description: { $nin: [null, ""] } })` — a raw `$nin` on a String path via `find`. Cast error, script dead on first run.

Fixed with `mongoose.trusted()`. Worth recording because it is evidence the trap is genuinely easy to fall into: the author of the document walked into it while the document was still the most recent commit. The audit command in that file caught it immediately, which is the argument for running it after every repository change.

---

## 4. Performance

Tiptap/ProseMirror added **~400KB raw / 126KB gzipped**. Loading that on the login screen would have been unacceptable, so the product editor route is **code-split**:

| Bundle | Gzipped |
|---|---|
| Main | 109 KB |
| ProductEditorPage (lazy) | 126 KB |

The editor's weight is paid only by someone who opens it. The public site is unaffected — Tiptap never ships there.

---

## 5. Delivered

| Requirement | Status |
|---|---|
| Media Library UI | Grid, folder/type/unused/missing-alt filters, multi-upload, detail drawer with alt/caption, delete blocked while in use, reusable picker |
| Product Editor | 5 tabs, Tiptap rich text, specifications with placeholder flags, publish gate showing **every** blocker at once |
| Category Management UI | List, create, edit, publish/unpublish, slug locked after publish |
| SEO Management UI | Meta title/description with live SERP preview and length guidance, canonical, schema type, noindex |
| Profile Screen | Active sessions with current flagged, individual revoke |
| Change Password UI | Current/new/confirm, server field errors mapped back to inputs, session survives |
| S1 | Implemented, verified, backfill provided |

---

## 6. Known Gaps

| Gap | Detail |
|---|---|
| **Packaging variant editor** | The tab exists and explains itself, but variants are API-only in this release. The product model supports them fully; this is UI work, not a data gap |
| Gallery / brochure pickers | Only `primaryImage` has a picker wired. Same pattern, more instances |
| Product reorder, duplicate, delete | Endpoints exist from 2C; no UI controls yet |
| Media replace | Endpoint exists; not surfaced in the drawer |
| Settings and Users screens | Still `comingSoon` in the nav |
| `GET /media/:id/usage` | Still unbuilt — the count and guard work, the itemised list does not |
| Rich-text round-trip test | Hostile input was verified via the **API**, which is the real threat model. Authoring hostile content *in the editor* and confirming the stored value has not been tested — recorded in RICH_TEXT_EDITOR_DECISION §9 |

---

## 7. Test Data

The four seeded leads are **intact and unmodified by this phase**:

| Lead | Status |
|---|---|
| `DEF-2026-00001` | new |
| `DEF-2026-00002` | lost |
| `DEF-2026-00003` | won |
| `DEF-2026-00004` | quotation_sent |

Statuses differ from Phase 2E because they were moved during board testing — that is the intended use.

**Still required.** They cover the pipeline board, status workflow, timeline, RBAC and dashboard aggregates, and nothing in 2F replaces them. There is no automated test suite, so they are currently the only regression coverage that exists for lead workflows.

**Recommendation: keep them** until `TESTING_STRATEGY.md` is implemented and those paths have real tests. **Not deleted, and no deletion without approval.**

Test catalogue data created during this phase (one category, one product) **was** removed, and the media `usageCount` decremented accordingly.
