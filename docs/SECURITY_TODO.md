# Security TODO

> Living register of every known deferred security item. Nothing here is implemented.
> Complements [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md), which describes the *intended* design. This file tracks the gap between that design and what is actually built.
>
> **Rule:** an item is removed only when the fix is verified behaviourally, not when the code is written.

---

## Severity Key

| Level | Meaning |
|---|---|
| **Live** | Exploitable in the running system today |
| **Latent** | Not exploitable yet because the consuming surface does not exist. Becomes Live the moment it does |
| **Hardening** | No known exploit path; reduces blast radius or raises attacker cost |

Nothing is currently **Live**. Three items become Live the moment their consuming surface ships — S1, S2 and S12 — which is why their target phases are tied to the feature that exposes them, not to a calendar.

---

## S1 — Product description HTML sanitisation

**Current state.** `Product.description` accepts up to 20 000 characters of raw HTML. `createProductSchema` validates length only. No sanitisation happens on write, and the stored value is returned verbatim by `GET /admin/products/:id`.

**Risk — Latent, becomes Live in 2F.** [SECURITY_ARCHITECTURE.md §6](SECURITY_ARCHITECTURE.md) requires allowlist sanitisation on write specifically so the database never holds an attack payload. Today it would. No renderer exists, so there is no live XSS path — but the first surface that renders it inherits stored XSS from every row written before the fix. The admin product editor preview in 2F is that surface.

An `editor`-role user is the likely author, which narrows the attacker set but does not close it: an editor who is phished escalates to an `admin` or `superadmin` session the moment one of them opens the product.

**Required fix.**
- Sanitise on write in `product.service`, against the allowlist in [SECURITY_ARCHITECTURE.md §6](SECURITY_ARCHITECTURE.md): `p, br, strong, em, u, ul, ol, li, a, h2, h3, h4, blockquote`; `a` limited to `href`/`title`/`rel` with `href` restricted to `http`, `https`, `mailto`, `tel`.
- Strip everything else — no `script`, `style`, `iframe`, `on*`, `javascript:` or `data:` URLs.
- Backfill existing rows through the same sanitiser (currently zero rows, so this is free today and expensive later).
- Escape on render regardless; `dangerouslySetInnerHTML` permitted only for this sanitised field.

**Target phase: 2F**, in the same change that ships the product editor. Not after.

---

## S2 — Rich text editor sanitisation strategy

**Current state.** No editor chosen. The CMS `richText` section type in [DATABASE_ARCHITECTURE.md §5.6](DATABASE_ARCHITECTURE.md) has the same exposure as S1 and does not exist yet either.

**Risk — Latent.** Sanitising server-side (S1) is the control that matters; client-side sanitisation is a UX nicety and is trivially bypassed by posting directly to the API. The risk here is choosing an editor whose output shape fights the allowlist — for example one that emits inline `style` attributes or wraps content in `div`s — and then widening the allowlist to accommodate it. **Widening the allowlist to suit a tool is how this becomes an incident.**

**Required fix.**
- Pick the editor to fit the allowlist, not the reverse. Evaluate against: does it emit only allowlisted tags by default, and can its schema be constrained?
- Server sanitisation (S1) remains authoritative regardless of the choice.
- Document the decision and the exact allowlist in [SECURITY_ARCHITECTURE.md §6](SECURITY_ARCHITECTURE.md) so a later contributor cannot quietly widen it.
- Round-trip test: author hostile input in the editor, confirm the stored value is clean.

**RESOLVED.** Tiptap, with `sanitize-html` server-side. Decision, allowlist and rationale: [RICH_TEXT_EDITOR_DECISION.md](RICH_TEXT_EDITOR_DECISION.md). The allowlist was **not** widened to suit the tool — Tiptap's schema was constrained to match it.

**Remaining in 2F:** implement S1 against that allowlist, in the same change as the editor.

---

## S3 — Media upload security review

**Current state.** Implemented in 2B and verified: magic-byte type detection, four-format allowlist (JPEG/PNG/WebP/PDF), size caps applied after real type is known, memory storage streamed to Cloudinary with nothing on server disk, server-regenerated filenames, SHA-256 dedupe, authenticated and role-gated with no public upload path.

**Risk — Hardening.** Four gaps remain:

1. **No malware scanning.** A valid PDF can carry a malicious payload. Uploads are admin-only, which bounds it, but a PDF served as a product brochure reaches the public.
2. **Cloudinary URLs are public and permanent.** Anything uploaded is world-readable to anyone holding the URL, including `certificates` and unpublished draft assets. There is no signed-URL or access-control layer.
3. **Magic-byte detection is hand-rolled** (`utils/fileType.ts`). Deliberate — `file-type` is ESM-only and fights the CommonJS build — but it is bespoke security code with no test suite.
4. **No re-encode.** Images are stored as uploaded rather than re-encoded, so format-specific parser exploits and embedded metadata pass through.

**Required fix.**
- Decide whether draft/certificate assets need signed URLs or a private delivery type. If yes, Cloudinary `type: authenticated` plus signed URLs at render.
- Add unit tests for `detectFileType` covering each allowed format, each rejected format, truncated files, and polyglots.
- Consider Cloudinary's incoming transformation (`f_auto,q_auto`) as a re-encode step, which also strips EXIF.
- Evaluate malware scanning for PDFs if brochures become public downloads.

**Target phase: 3** for signed URLs and re-encode; **tests alongside the first test harness** (`TESTING_STRATEGY.md`).

---

## S4 — Admin authentication hardening

**Current state.** Implemented: bcrypt cost 12, 15-minute access tokens, rotating refresh tokens with reuse detection, per-account lockout after 5 failures for 30 minutes, per-IP login throttle, enumeration resistance verified, role read from the database on every request.

**Not implemented, despite being specified in [API_SPECIFICATION.md §5.1](API_SPECIFICATION.md):**

| Endpoint | Status |
|---|---|
| `POST /auth/forgot-password` | **Missing** |
| `POST /auth/reset-password` | **Missing** |
| `PATCH /auth/change-password` | **Missing** — `changePasswordSchema` was written then removed as dead code |

**Risk — Hardening, trending to Live.** There is currently **no way for an admin to change their own password**. The only credential a user has is the one printed once by `seed:admin`. Practical consequences: a suspected-compromised password cannot be rotated without database access; a departing staff member's credential can only be revoked by deactivating the account; and the one-time seed password tends to end up in a chat log or password-less note because there is no path to replace it.

`passwordChangedAt` already exists on the User model and already invalidates earlier access tokens — the enforcement is built, the endpoint is not.

**Required fix.**
- `PATCH /auth/change-password` — current + new password, revokes all refresh tokens, sets `passwordChangedAt`.
- `POST /auth/forgot-password` — always returns 200 regardless of whether the email exists; sends a single-use, time-limited, hashed token (`passwordResetTokenHash`/`passwordResetExpiresAt` already exist on the model).
- `POST /auth/reset-password` — consumes the token, revokes all sessions.
- Reject the top-10k common-password list on set and change ([SECURITY_ARCHITECTURE.md §3](SECURITY_ARCHITECTURE.md)).
- 2FA for `superadmin` — separate, later.

**Target phase: 2D** for change-password (the admin shell needs it and it is the highest-value gap); **3** for reset-by-email, which needs SMTP; 2FA unscheduled.

---

## S5 — Session management review

**Current state.** Access token 15 min held in memory client-side; refresh token opaque, SHA-256-hashed at rest, HttpOnly + Secure + SameSite=Strict, path-scoped to `/api/v1/admin/auth`, rotated on every use with chain revocation on reuse. `logout` and `logout-all` exist. Deactivation and role change revoke all refresh tokens.

**Risk — Hardening.** Four gaps:

1. **No session visibility.** A user cannot see or revoke their active sessions. `refreshtokens` stores `userAgent` and `ipHash` precisely to support this, and nothing surfaces it.
2. **Idle timeout is unenforced server-side.** [ADMIN_PANEL_SPECIFICATION.md §6](ADMIN_PANEL_SPECIFICATION.md) describes a 30-minute idle logout. That is client-side only; a captured refresh token stays valid for its full 7 days regardless of idleness.
3. **`secure: false` in development** is correct locally but depends entirely on `NODE_ENV` being right in production — the exact failure mode of Phase 1 review H2.
4. **No re-authentication for sensitive actions.** Lead export, user deactivation and role change are protected by role alone, not by a password re-prompt.

**Required fix.**
- `GET /auth/sessions` and `DELETE /auth/sessions/:id`, surfaced in the admin profile screen.
- Consider a server-side absolute idle window: refuse a refresh whose token has not been used within N hours.
- Re-authentication prompt for lead export and user-management mutations.
- Startup assertion that `secure` is true whenever `NODE_ENV=production`.

**Target phase: 2D** for the `secure`-flag assertion; **2E** for session listing (it lives on the profile screen); re-authentication with the user-management screens in **Phase 4**.

---

## S6 — CSRF strategy

**Current state.** Two mechanisms, no tokens:

1. The refresh cookie is `SameSite=Strict`, so a cross-site request does not carry it.
2. CORS uses an explicit origin allowlist with `credentials: true`.

Every state-changing admin endpoint authenticates via `Authorization: Bearer`, which a cross-site form or image tag cannot set. **The only cookie-authenticated endpoint is `POST /auth/refresh`.**

**Risk — Hardening.** The residual surface is narrow but real:

- `SameSite=Strict` is the whole defence for `/auth/refresh`. Cross-site forgery of that endpoint yields a rotated token pair the attacker cannot read (HttpOnly), so the practical impact is a denial of service against the victim's session — the rotation invalidates their current token. Low impact, non-zero.
- The strategy is currently **implicit**. Nobody has written down that bearer-only authentication is what makes admin mutations CSRF-immune, so a future contributor adding a cookie-authenticated mutation would silently open a real hole.

**Required fix.**
- Document the strategy explicitly in [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md): *admin mutations authenticate by bearer token only; no state-changing endpoint may authenticate by cookie.* That invariant is the control.
- Add double-submit CSRF tokens **only if** a cookie-authenticated mutation ever becomes necessary.
- Verify `SameSite=Strict` survives the admin app being served from a different subdomain than the API — a same-site-but-cross-origin setup still sends Strict cookies, but the CORS allowlist must include the admin origin.

**Target phase: 2D** — write the invariant down while the admin client is being built against it.

---

## S7 — Security headers review

**Current state.** `helmet()` with defaults plus `frameguard: deny`. Verified live: HSTS `max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `x-powered-by` removed.

**Not implemented:** the explicit Content-Security-Policy in [SECURITY_ARCHITECTURE.md §9](SECURITY_ARCHITECTURE.md), `Referrer-Policy`, and `Permissions-Policy`.

**Risk — Hardening.** Helmet's default CSP is either absent or extremely permissive depending on configuration, so there is no script-injection backstop. CSP is defence in depth behind S1/S2 rather than a primary control, but it is the layer that limits the damage when sanitisation is wrong.

The policy cannot be finalised yet: it must cover the public site's Google Fonts origins, Cloudinary image delivery, the API origin, and the analytics provider — and two of those are not deployed.

**Required fix.**
- Author the CSP from [SECURITY_ARCHITECTURE.md §9](SECURITY_ARCHITECTURE.md), with **separate policies** for the public site and the admin app; the admin app needs no font or analytics origins.
- Ship in `Report-Only` for one week before enforcing. A CSP that breaks the contact form is a lead-generation outage.
- Remove `style-src 'unsafe-inline'` via nonces once the public site is on Vite.
- Add `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: geolocation=(), microphone=(), camera=()` now — neither depends on deployment.

**Target phase: 2D** for `Referrer-Policy` and `Permissions-Policy`; **3** for CSP, once the origins are known.

---

## S8 — Future SVG support requirements

**Current state.** SVG is deliberately excluded from the upload allowlist. `utils/fileType.ts` documents why; an SVG containing `<script>` renamed to `.png` was verified rejected.

**Risk — none while excluded.** This item exists so the exclusion is not quietly reversed. SVG is XML and executes script; served from an origin holding a session cookie, an uploaded SVG is stored XSS.

**Required before SVG is ever accepted — all of it, not a subset:**
1. Real DOM-parsing sanitisation (DOMPurify with `jsdom`, or equivalent), never regex.
2. Sanitise on write; the stored file must already be clean.
3. Strip `script`, `foreignObject`, all `on*` handlers, `xlink:href`/`href` to non-`#` targets, and external references.
4. Serve from a **separate origin** with no session cookie, or with `Content-Disposition: attachment`.
5. `Content-Security-Policy: sandbox` on the delivery response.
6. Test suite covering the known SVG XSS corpus.

If any of those cannot be met, the correct answer stays "no SVG" — [SECURITY_ARCHITECTURE.md §7](SECURITY_ARCHITECTURE.md) is explicit that dropping the format beats shipping a weak sanitiser. Nothing currently requires SVG; the logo is a PNG.

**Target phase: unscheduled.** Only on a concrete business need for vector assets.

---

## S9 — No rate limiting on admin mutations

**Current state.** Rate limits exist on public lead capture (5/hour), login (10/15 min), lead export (5/hour), and a 300/15 min global limit. Every other admin endpoint has only the global limit.

**Risk — Hardening.** A compromised admin session can enumerate leads via paginated reads or mass-mutate the catalogue well within 300 requests per 15 minutes. The global limit is scanner protection, not abuse protection.

**Required fix.** Per-user (not per-IP) limits on admin reads and mutations, keyed on `req.user.id`. Bulk-read endpoints — lead list in particular — matter most, because paginating the whole lead table is a slow-motion export that bypasses the export audit trail.

**Target phase: 2E**, with the lead screens that will exercise those endpoints.

---

## S10 — Audit log diffs are not allowlist-based

**Current state.** [SECURITY_ARCHITECTURE.md §11](SECURITY_ARCHITECTURE.md) specifies field-level diffs built from "an explicit per-entity allowlist" so a `select: false` field cannot land in a diff. Implementation is ad hoc: `leadAdmin.service` diffs the changed keys, `product.service` records `{ field: { changed: true } }` without values, `category.service` records from/to.

**Risk — Hardening.** No sensitive field currently reaches a diff — `passwordHash` is never in a patch object, and lead PII is not diffed. But the protection is incidental rather than structural. A future contributor adding a service that spreads a whole document into `changes` would leak it into a 365-day-retained collection.

**Required fix.** A shared `buildDiff(entityType, before, after)` helper with a per-entity field allowlist, used by every service. Remove the ad-hoc diff code.

**Target phase: 4**, or immediately if a new entity type is added.

---

## S11 — No CI, no dependency scanning, no tests

**Current state.** No CI pipeline. `npm audit` has never run in an automated context. No test suite of any kind. [SECURITY_ARCHITECTURE.md §12](SECURITY_ARCHITECTURE.md) lists nine verification checks; all nine have been performed manually and none is automated, so none will catch a regression.

**Risk — Hardening.** Every security control verified so far — RBAC, the publish gate, magic-byte rejection, mass-assignment stripping, token reuse detection — can regress silently. `react-scripts@5.0.1` also carries known transitive advisories.

**Required fix.** CI running `npm ci`, `npm run typecheck`, `npm audit --audit-level=high`, and the §12 checks as automated tests. `TESTING_STRATEGY.md` is already flagged as needed before Phase 2 in [FUTURE_DOCS.md](FUTURE_DOCS.md) and is now overdue.

**Target phase: 3.** The §12 security checks should be the first tests written, not the last.

---

## S12 — Admin app client-side security

**Current state.** Nothing built. Listed here so the decisions are made deliberately during 2D rather than by default.

**Risk — Latent, becomes Live when the admin app ships.**

**Required — decided in [ADMIN_UI_ARCHITECTURE.md](ADMIN_UI_ARCHITECTURE.md) and enforced in 2D:**
- Access token in memory only. Never `localStorage`, `sessionStorage`, or a non-HttpOnly cookie.
- No `dangerouslySetInnerHTML` anywhere except the sanitised `description` field, behind a single reviewed wrapper component.
- The admin app is `noindex` and never linked from the public site.
- Route guards are UX, not security — every route's data is authorised server-side regardless.
- No secret in the admin bundle. `VITE_*` variables are public by construction; only the API base URL qualifies.
- Source maps not published to production.

**Target phase: 2D.**

---

## S13 — Unpatched advisory in react-router-dom

**Current state.** `react-router-dom@7.18.2` (latest) carries GHSA-qwww-vcr4-c8h2, "RSC Mode CSRF Bypass Allows Action Execution Before 400 Response", affecting `react-router` 7.12.0–8.2.0. **No fixed version exists.**

Downgrading is worse, not better: 7.11.0 and below carry 14 advisories including open redirect, stored XSS, and an RCE via turbo-stream deserialization. Latest is the least-bad option.

**Risk — none in this configuration.** The advisory concerns React Server Components mode and server actions. The admin app is a pure client-side SPA using `BrowserRouter` with no RSC, no server actions, and no server-side data loaders. The vulnerable code path is never entered.

**Required fix.** Upgrade when a patched version ships. Until then:
- Do **not** adopt RSC mode, server actions, or framework-mode data routers in this app without re-evaluating.
- Recheck on each dependency review.

**Target phase: monitor.** Re-evaluate at the CI/dependency-scanning work in S11.

---

## Summary

| # | Item | Severity | Target |
|---|---|---|---|
| S1 | Product description sanitisation | Latent → Live at 2F | **2F** |
| S2 | Rich text editor strategy | **DECIDED** — Tiptap + sanitize-html | — |
| S3 | Media upload review | Hardening | 3 |
| S4 | Auth hardening | **Change-password DONE** (2E). Reset-by-email still open | 3 (reset) |
| S5 | Session management | **Endpoints DONE** (2E); UI, idle timeout and re-auth still open | 2F (UI) / 4 |
| S6 | CSRF strategy | Hardening | **2D** (document) |
| S7 | Security headers / CSP | Hardening | 2D (2 headers), 3 (CSP) |
| S8 | SVG support | None while excluded | Unscheduled |
| S9 | Admin mutation rate limits | **DONE** (2E) | — |
| S10 | Audit diff allowlist | Hardening | 4 |
| S11 | CI, scanning, tests | Hardening | 3 |
| S12 | Admin client-side security | Latent → Live at 2D | **2D** |

**Do first:** S4 (there is no way to change a password), S12 (decided while building), S6 (write the invariant down before it is broken).

**Do not let slip:** S1 must ship in the same change as the product editor. Once content is authored, backfilling a sanitiser across existing rows is strictly harder than sanitising from row one — and today there are zero rows.
