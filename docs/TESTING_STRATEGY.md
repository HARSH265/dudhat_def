# Testing Strategy

> Overdue since Phase 2. **Nothing here is implemented yet** — this document
> defines the method and the checklists; the code does not exist.
>
> The governing idea is §1. Everything else follows from it.

---

## 1. Consequence-Based Testing — the method

**Assert the resulting state, not the response.**

Three bugs have shipped in this project that returned a plausible-looking response while doing nothing at all:

| Bug | What it returned | What it actually did |
|---|---|---|
| Refresh-token reuse detection (1C) | `401` to the caller | **Never revoked the chain.** A stolen token kept working |
| `unique: true` with no index (1 review) | `201` on every write | **Enforced no constraint.** Duplicates possible |
| Password change killing its own session (2E) | `200` and a new token | **Also killed the session it was meant to preserve** |

A test asserting *"the endpoint returned an error"* passes all three.

So every check below is written as **action → observable consequence**, never *action → status code*.

| Instead of asserting | Assert |
|---|---|
| Reuse returns 401 | Reuse returns 401 **and the successor token is now dead** |
| Delete returns 409 | Delete returns 409 **and `usageCount` matches actual references** |
| Duplicate returns 409 | Duplicate returns 409 **and the index exists in this environment** |
| Update returns 200 | Update returns 200 **and a re-read shows the new value** |
| Sanitiser returns 201 | Sanitiser returns 201 **and the stored row contains no payload** |
| Publish returns 422 | Publish returns 422 **and the product status is still `draft`** |

---

## 2. Test Layers

| Layer | Scope | Priority |
|---|---|---|
| **Security integration** | The nine checks in `SECURITY_ARCHITECTURE.md` §12, written as consequence assertions | **First.** These are the ones that regress silently |
| Unit | Pure functions with real logic: `passwordPolicy`, `richText` sanitiser, `fileType` magic bytes, `slug`, `phone`, `STATUS_TRANSITIONS` | High — cheap, no database |
| Repository | Every query, against a real MongoDB. Catches the `MONGOOSE_GOTCHAS` §1 class | High |
| Service | Business rules: publish gate, status machine, media usage diff, escalation guards | High |
| API integration | Endpoint behaviour including RBAC and rate limits | Medium |
| UI | Admin screens | Low — manual for now |

**Repository tests need a real MongoDB**, not a mock. The entire `MONGOOSE_GOTCHAS` §1 class of bug is invisible to a mocked driver: the cast error happens inside Mongoose. A mock would have passed every one of them.

---

## 3. Manual Testing Procedures

Until automation exists, these are run by hand before each phase is called done.

### Setup

```bash
npm --prefix server run dev
npm --prefix admin run dev
npm --prefix client start
```

Sign in at `/admin`. The four seeded leads must be present.

### Smoke — 2 minutes, run after any server change

| Check | Expected |
|---|---|
| `GET /` | 200, "Dudhat DEF API is running..." |
| `GET /api/contact` | **404** — this endpoint was a data leak and must stay gone |
| `POST /api/contact` with `{}` | 400, message exactly `Please fill all required fields (name, email, phone, message)` |
| Public contact form submits | 201, lead appears in the admin list |
| `/admin` unauthenticated | Redirects to login |
| `GET /api/v1/admin/leads` without token | 401 |

The legacy 400 string is asserted **verbatim**. `ContactForm.jsx` renders it directly, and it is the only conversion path on the site.

---

## 4. Lead Workflow Testing

Uses the four seeded leads. **Do not delete them.**

| # | Action | Consequence to verify |
|---|---|---|
| L1 | Submit the public contact form | New lead, sequential `leadNumber`, `status: new`, one `created` activity |
| L2 | Submit with `website` filled (honeypot) | **201 returned**, and **no lead row created** |
| L3 | Submit 6 times in an hour | 6th returns 429 |
| L4 | Move `new → contacted` | Status changes, `firstContactedAt` stamped, activity written |
| L5 | Move `new → won` | **409**, and a re-read shows the status **unchanged** |
| L6 | Move `→ lost` without a reason | 400, status unchanged |
| L7 | Move `→ lost` with a reason | Status changes, `closedAt` stamped, reason on the timeline |
| L8 | Move `lost → contacted` | 409 — terminal |
| L9 | Add a note | Appears on the timeline with the correct author |
| L10 | Assign to an `editor` | **400** — editors have no lead access |
| L11 | Drag a card to an illegal column on the board | Column dims before drop; if forced, the card returns to its true column |
| L12 | Export CSV | Downloads, row count in `X-Export-Rows`, an `export` audit record exists, phone cells beginning `+` are apostrophe-prefixed |
| L13 | Export 6 times in an hour | 6th returns 429 |
| L14 | Submit a message containing `=1+1` | Exported CSV cell is `"'=1+1"`, not a formula |

---

## 5. Product Workflow Testing

| # | Action | Consequence |
|---|---|---|
| P1 | Create a product with no slug | Slug derived from name, lowercase, hyphenated |
| P2 | Create with a duplicate slug | 409 `DUPLICATE_SLUG` |
| P3 | Publish missing a primary image | 422 listing **every** blocker at once, status still `draft` |
| P4 | Publish with `isPlaceholder: true` on any spec | 422 naming the spec, status still `draft` |
| P5 | Publish with `[PLACEHOLDER]` in a badge | 422 quoting the badge |
| P6 | Publish a complete product | 200, `publishedAt` stamped |
| P7 | Change the slug of a **published** product | 409 — redirects do not exist yet |
| P8 | Change the slug of a draft | Allowed |
| P9 | Duplicate a product | `-copy` suffix, forced `draft`, SKU cleared, counters at 0 |
| P10 | Rename a category | `categoryName` on every product in it updates |
| P11 | Archive a category with a published product | 409 naming the blocking products |
| P12 | Delete a category with any product | 409 with the count |
| P13 | Create with a non-existent `categoryId` | 400 |
| P14 | Create with a non-existent `mediaId` | 400 |
| P15 | Three-level category nesting | 400 — one level only |

### Rich text sanitisation — post directly to the API, not through the editor

The editor cannot produce these; the threat model is a crafted request.

| Input | Stored value must contain |
|---|---|
| `<script>alert(1)</script>` | no `<script>` |
| `<img src=x onerror=alert(1)>` | no `onerror`, no `<img>` |
| `<a href="javascript:alert(1)">` | no `href` |
| `<a href="jAvAsCrIpT:alert(1)">` | no `href` — case-insensitive |
| `<a href="data:text/html,...">` | no `href` |
| `<a href="//evil.example">` | no `href` — protocol-relative |
| `<p style="position:fixed">` | no `style` |
| `<p class="x">` | no `class` |
| `<h1>`, `<iframe>`, `<svg onload>` | none present |
| `<a href="https://ok" rel="" target="_self">` | `rel="noopener noreferrer nofollow"`, `target="_blank"` |
| Valid `<p><strong><a><ul><li>` | preserved intact |

Verify on **create, update and duplicate**. Duplicate matters: it must not launder a pre-sanitiser row forward.

**Round-trip (not yet done):** author hostile content *in the Tiptap editor*, save, and assert the stored value. Recorded as open in `RICH_TEXT_EDITOR_DECISION.md` §9.

---

## 6. Media Workflow Testing

| # | Action | Consequence |
|---|---|---|
| M1 | Upload a real PNG | Stored, dimensions parsed from the header, reachable on the CDN |
| M2 | Upload an SVG renamed `.png` | **415** — magic bytes, not extension |
| M3 | Upload GIF bytes named `.png` | 415 |
| M4 | Upload a PDF | Accepted as `document` |
| M5 | Upload the same bytes twice | Same `_id` returned, `wasDuplicate: true`, **no second Cloudinary asset** |
| M6 | Upload a 6MB image | 413 |
| M7 | Attach media to a product | `usageCount` increments |
| M8 | Delete while `usageCount > 0` | 409 naming the count, **asset still present** |
| M9 | Remove the reference, then delete | `usageCount` reaches 0, delete succeeds |
| M10 | Use one asset as both primary image and variant image | `usageCount` is **1**, not 2 — references dedupe per document |
| M11 | Replace a file | Same `_id`, new URL, old asset destroyed |
| M12 | Replace an image with a PDF | 400 — cross-type replace refused |
| M13 | `npm run reconcile:media` after all of the above | Reports **no drift** |

M13 is the real test of M7–M10: it recomputes counts from actual references and will expose any lost increment.

---

## 7. RBAC Testing

Run **every** row. Role separation runs both ways and has been wrong in both directions before.

| Action | superadmin | admin | editor | sales |
|---|---|---|---|---|
| `GET /admin/leads` | 200 | 200 | **403** | 200 |
| `PATCH /admin/leads/:id` | 200 | 200 | **403** | 200 |
| `POST /admin/leads/:id/assign` | 200 | 200 | **403** | **403** |
| `GET /admin/leads/export` | 200 | 200 | **403** | **403** |
| `DELETE /admin/leads/:id` | 200 | **403** | **403** | **403** |
| `GET /admin/products` | 200 | 200 | 200 | **403** |
| `POST /admin/products` | 201 | 201 | 201 | **403** |
| `DELETE /admin/products/:id` | 200 | 200 | **403** | **403** |
| `PATCH /admin/categories/:id/status` | 200 | 200 | **403** | **403** |
| `POST /admin/media/upload` | 201 | 201 | 201 | **403** |
| `DELETE /admin/media/:id` | 200 | 200 | **403** | **403** |
| `POST /admin/auth/users` | 201 | **403** | **403** | **403** |

Plus:

| Check | Consequence |
|---|---|
| Assign a lead to an `editor` | 400 — content roles hold no customer data |
| Demote the last active superadmin | 409, and the role is **unchanged** |
| Deactivate your own account | 400 |
| Change your own role | 400 |
| Deactivate a user | Their refresh tokens are revoked **immediately**, not at expiry |
| Change a user's role | Same |
| `role` in a request body | **Stripped** — not merely ignored. Re-read the document to confirm |

---

## 8. Security Testing Procedures

The nine checks from `SECURITY_ARCHITECTURE.md` §12, as consequences.

| # | Check | Consequence |
|---|---|---|
| S1 | No unauthenticated lead access | Every `/admin/*` route without a token returns 401 |
| S2 | Role enforcement | Per §7, every route × role pair |
| S3 | Mass assignment | `role` in a user-update body does not change the role **in the database** |
| S4 | NoSQL injection | `{"$gt":""}` in a query param returns 400, **not a result set** |
| S5 | XSS | `<script>` in a description is absent from the **stored row** |
| S6 | Rate limiting | 6th lead submission in an hour returns 429 |
| S7 | Upload type bypass | A renamed `.html` file with a `.png` extension is rejected |
| S8 | Secrets in bundle | Grep the production build for `SECRET`, `MONGO`, `PASSWORD` — zero hits |
| S9 | Headers | HSTS, `nosniff`, `X-Frame-Options: DENY`, no `x-powered-by` |

### Auth-specific

| # | Check | Consequence |
|---|---|---|
| A1 | Enumeration | Unknown email and wrong password return byte-identical responses |
| A2 | Lockout | 6th failure locks the account; the 7th is refused even with the **correct** password |
| A3 | Token rotation | Refresh returns a new token and the old one is dead |
| A4 | **Reuse detection** | Replaying a rotated token revokes the chain — **verify the successor token is also dead** |
| A5 | **Administrative revocation is not reuse** | After a password change, another device's refresh returns 401 **and the changing device stays signed in** |
| A6 | `passwordChangedAt` | Access tokens issued before a password change stop working |
| A7 | Password policy | `password123456` is rejected — substring matching, not exact |
| A8 | Session scoping | Revoking another user's session id returns 404, not 403 — no existence leak |

A4 and A5 are the two that have failed before. Both must be asserted together: they pull in opposite directions, and fixing one previously broke the other.

---

## 9. Verification Checklist — every future phase

Run before any phase is called complete.

**Build**
- [ ] `npm --prefix server run typecheck` clean
- [ ] `npm --prefix server run build` clean
- [ ] `npm --prefix admin run build` clean, no new warnings
- [ ] `npm --prefix client run build` clean **if `client/` was touched**

**Database**
- [ ] `npm run sync:indexes` — no unexpected changes
- [ ] `npm run reconcile:media` — no drift
- [ ] Mongoose audit command from `MONGOOSE_GOTCHAS.md` — every hit is `countDocuments`, aggregation, or `trusted()`

**Security**
- [ ] §8 S1–S9 pass
- [ ] §8 A1–A8 pass if auth was touched
- [ ] No secret in any staged file (`git diff --cached`)
- [ ] `npm audit --audit-level=high` reviewed; any residual advisory recorded in `SECURITY_TODO.md`

**Regression**
- [ ] §3 smoke passes
- [ ] Four seeded leads intact
- [ ] Public contact form submits end to end
- [ ] Legacy 400 and 201 messages byte-identical

**Design freeze** (only if `client/` was touched)
- [ ] Visually identical at 320 / 640 / 768 / 1024 / 1280
- [ ] No new UI element without approval

**Data hygiene**
- [ ] Test records removed, or explicitly reported and approval requested
- [ ] Cloudinary test assets removed
- [ ] `usageCount` reconciled after removing anything referencing media

**Documentation**
- [ ] `PROJECT_STATUS.md` updated — phase, capabilities, risks, next task
- [ ] Any doc that now describes something untrue is corrected

---

## 10. Tooling — not yet chosen

Recommended when this is implemented:

| Need | Suggestion | Why |
|---|---|---|
| Runner | `node --test` | Built in. This environment has broken `esbuild` and `ts-node`; a zero-dependency runner avoids a third incident |
| HTTP | `supertest` | Pure JS |
| Database | `mongodb-memory-server`, **or** a real Atlas test database | The in-memory server downloads a binary, which may hit the same postinstall block. A dedicated Atlas database is the safer fallback |
| CI | GitHub Actions | `npm ci`, typecheck, `npm audit --audit-level=high`, then this suite |

**Do not mock Mongoose.** The whole `MONGOOSE_GOTCHAS` §1 class is invisible to a mock, and that class has caused five bugs here.

---

## 11. Priority Order

1. **§8 security checks** — the ones that regress silently
2. **Unit tests** for `richText`, `passwordPolicy`, `fileType` — pure, fast, no database
3. **Repository tests** against a real MongoDB — the `sanitizeFilter` class
4. **Service tests** — publish gate, status machine, media usage
5. API integration and RBAC matrix
6. UI — last, and manual until the rest exists

Anything is better than the current zero. Start with §8.
