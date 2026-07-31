# Phase 1 Exit Review

> Scope: `server/` as of commit `0218fa8`. Review only — nothing was changed.
> Method: static analysis plus behavioural testing against a running server on the live Atlas connection. Every finding below was reproduced, not inferred.
> Related: [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md), [API_SPECIFICATION.md](API_SPECIFICATION.md), [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md)

---

## 1. Verdict

Phase 1 delivers what it claimed: layering, auth, RBAC, audit, and the lead model. **It is not production-deployable as it stands.** Three high-severity issues (§3) are all configuration or deployment gaps rather than logic defects, and all three are invisible in development — which is why they need to be closed before Phase 2 rather than discovered at deploy time.

Nothing found here contradicts a Phase 0 control. All eight Phase 0 protections were re-verified intact (§7).

| Severity | Count |
|---|---|
| High | 3 |
| Medium | 6 |
| Low | 11 |
| Verified clean | 8 |

---

## 2. What Was Verified Clean

Stated up front so it is not re-tested later.

| Check | Result |
|---|---|
| Unused dependencies | **None.** All 13 runtime deps are imported |
| Circular imports | **None.** Full graph walked across 24 modules |
| Mass assignment | Blocked — `role` and `isAdmin` in a request body do not reach the document |
| Enumeration resistance | Unknown email and wrong password return byte-identical responses; unknown email still runs a bcrypt comparison so timing matches |
| Refresh rotation + reuse detection | Reusing a rotated token revokes the entire chain; verified the successor token dies too |
| RBAC | `editor` attempting a `superadmin` route returns 403 |
| Rate limit bypass | **None.** The same limiter instance backs `/api/contact` and `/api/v1/leads`, so the 5/hour budget is shared. Confirmed: the 5th request across both returns 429 |
| Secrets in git | `.env` correctly ignored; no secret literal in any tracked file |

---

## 3. High

### H1 — Production would run with no indexes at all

`src/config/db.ts` sets `autoIndex: !isProduction`, and **no migration step exists to create indexes instead.** [DATABASE_ARCHITECTURE.md §6](DATABASE_ARCHITECTURE.md) says indexes are "applied by an explicit, idempotent migration step in the deploy pipeline" — that step was never built.

Consequence on first production deploy: all 30 declared indexes are absent. This is not only a performance problem.

| Lost index | Consequence |
|---|---|
| `leads.leadNumber` unique | **Duplicate lead numbers become possible** |
| `users.email` unique | **Two accounts can share an email**; login becomes ambiguous |
| `refreshtokens.tokenHash` unique | Token collision handling degrades |
| `refreshtokens.expiresAt` TTL | Expired refresh tokens **never deleted** — table grows without bound |
| `activitylogs.createdAt` TTL | 365-day audit retention **silently does not happen** |
| `leads.status/createdAt` | Pipeline queries become full collection scans |

Uniqueness in MongoDB is enforced *by the index*, not the schema. Mongoose's `unique: true` is an index directive, not a validator — with `autoIndex` off and no migration, it enforces nothing.

Verified: 30 indexes exist in the current dev database precisely because `autoIndex` is on there. That is the only reason.

**Fix direction:** an idempotent `syncIndexes` migration run as a deploy step, plus a startup assertion that fails loudly if expected indexes are missing.

### H2 — `NODE_ENV` is unset, and every production safeguard keys off it

Confirmed: `NODE_ENV` is not present in `server/.env`, so `env.nodeEnv` falls back to `"development"` and `isProduction` is `false`. Four controls degrade silently if this reaches a server:

| Control | Behaviour when `isProduction` is false |
|---|---|
| `secret()` in `config/env.ts` | Missing JWT secrets **do not throw** — an ephemeral random secret is generated instead. Every restart silently invalidates all sessions, and the secret is never persisted |
| Refresh cookie `secure` flag | `false` — the refresh token is transmitted over plain HTTP |
| `requestId` in error bodies | Disclosed to the client |
| `autoIndex` | Enabled — which accidentally masks H1, but by luck rather than design |

The `secret()` fallback is the dangerous one: it was written to make development frictionless, and the production guard it relies on is a variable nobody has set.

**Fix direction:** `NODE_ENV` should be required rather than defaulted, or the production guard should key off something that cannot be absent by accident.

### H3 — `IP_HASH_SALT` is unset, so IP hashes use a salt committed to git

`src/utils/crypto.ts`:

```
const salt = process.env["IP_HASH_SALT"] ?? "dhudhat-dev-salt";
```

Confirmed unset. Every `ipHash` on a lead and every audit record is therefore salted with a constant that is in the repository and in git history. IPv4 space is small enough to exhaust; a known salt makes those hashes reversible by anyone with repo access.

This defeats the stated purpose of the control in [SECURITY_ARCHITECTURE.md §8](SECURITY_ARCHITECTURE.md), which hashes IPs specifically so raw addresses are not retained.

**Fix direction:** required in production, no in-source default.

---

## 4. Medium

### M1 — Misleading validation message on the only conversion path

Any field-level failure returns the legacy "missing fields" copy, even when no field is missing.

| Request | Message returned |
|---|---|
| `message: "hi"` (all fields present) | `"Please fill all required fields (name, email, phone, message)"` |
| `name: "R"` (all fields present) | `"Please fill all required fields (name, email, phone, message)"` |

Cause: `middleware/validate.ts` treats any `too_small` issue as a missing required field:

```
issue.code === "invalid_type" || (issue.code === "too_small" && issue.path.length > 0)
```

`too_small` also fires for a too-short-but-present value. The accurate message *is* produced and sits in `errors[]`, but `ContactForm.jsx` renders only `res.data.message`, so the user sees the wrong one.

Impact is on the site's single conversion path: a genuine enquirer who writes a brief message is told to fill in fields they already filled.

### M2 — `/api/v1/leads` silently discards documented fields

[API_SPECIFICATION.md §4.3](API_SPECIFICATION.md) specifies `type`, `productSlug`, `quantity`, `city`, `state`, `sourcePage` and `utm` on this endpoint. `contactSchema` defines none of them and `.strip()` removes unknown keys, so they vanish without error.

Verified — posting `type: "quote"`, `quantity: "20 drums"`, `city: "Rajkot"` returned 201 and stored:

```
type     : contact   (sent "quote")
quantity : DROPPED
city     : DROPPED
```

`type` is the field that distinguishes a quote request from a general enquiry — the "Quote Requests" dashboard KPI in [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md) is computed from it. Every submission is currently recorded as `contact`.

The `Lead` model supports all these fields. Only the validator and service do not.

### M3 — Oversized payload returns 500, not 413

A 200KB body returns `500 INTERNAL_ERROR`. [API_SPECIFICATION.md §2](API_SPECIFICATION.md) specifies `413`. `middleware/errorHandler.ts` has no branch for body-parser's `entity.too.large`, so a correctly-rejected request is reported as a server fault and logged at `error` level — noise that will mask real incidents.

### M4 — The lead status state machine is defined but never enforced

`STATUS_TRANSITIONS` in `models/Lead.ts` is exported and imported by nothing. There is no code path that consults it. [DATABASE_ARCHITECTURE.md §5.7](DATABASE_ARCHITECTURE.md) presents transition validation as a guarantee; today it is a comment with a data structure next to it.

Acceptable only because no status-update endpoint exists yet. It becomes a real defect the moment one does, so it should be wired in the same change that adds the endpoint — not left as an assumed-existing control.

### M5 — The last-superadmin guard is documented but not implemented

[ADMIN_PANEL_SPECIFICATION.md §5.13](ADMIN_PANEL_SPECIFICATION.md) states the last active `superadmin` cannot be demoted, deactivated, or deleted. `userRepository.countActiveSuperadmins()` exists for exactly this and **is called from nowhere**.

No user-update endpoint exists yet, so nothing is currently broken. But the helper's presence makes the guard look implemented on a casual read.

### M6 — Migrated leads and new leads store phone numbers differently

`lead.service.ts` normalises to E.164 (`9876543210` → `+919876543210`). `scripts/migrateContactsToLeads.ts` copies `phone` verbatim.

Verified in the migration test: the migrated lead kept `9876500123` while a live submission stored `+919876543210`. One collection, two formats, so any lookup by phone must try both. The migration is idempotent and skips already-migrated rows, meaning a later fix cannot repair these by re-running.

Currently zero rows are affected — the `contacts` collection is empty — so this is cheap to fix now and expensive later.

---

## 5. Low

| # | Finding | Location |
|---|---|---|
| L1 | `Contact.ts` model is fully orphaned. Nothing imports it; the migration reads the raw collection. Dead code | `models/Contact.ts` |
| L2 | `safeEqual()` is never called | `utils/crypto.ts` |
| L3 | `changePasswordSchema` has no route | `validators/auth.validator.ts` |
| L4 | `authService.logoutAll()` has no route | `services/auth.service.ts` |
| L5 | Request-context extraction (`ipHash` + `userAgent`) is duplicated between `auth.controller.ts` `context()` and the inline block in `contactController.ts` | 2 files |
| L6 | The cookie path `/api/v1/admin/auth` is a literal in both `app.ts` and `auth.controller.ts`. Changing the mount silently breaks logout and refresh, because the cookie would be set on a path the browser no longer sends | 2 files |
| L7 | `contactController.ts` no longer handles contacts — it creates leads. The filename contradicts the module | `controllers/` |
| L8 | The migration writes provenance into `lead.utm.migratedFrom`, conflating marketing attribution with migration bookkeeping. `utm` is `Mixed`, so nothing prevents it | `scripts/migrateContactsToLeads.ts` |
| L9 | `authenticate` reads the user from the database on every admin request. Correct for immediate deactivation, but uncached — worth revisiting when the admin panel generates real traffic | `middleware/authenticate.ts` |
| L10 | Non-null assertion `req.user!.id` rather than a narrowed type | `controllers/auth.controller.ts` |
| L11 | The seeded superadmin is `himanshu@dudhatdef.com`; every document and the settings seed use `dhudhatdef.com` (with the `h`). One of the two spellings is wrong, and the wrong one will end up in customer-facing email | seed data vs `SEED_DATA.md` |

---

## 6. Hardcoded Values

| Value | Location | Assessment |
|---|---|---|
| `"dhudhat-dev-salt"` | `utils/crypto.ts` | **H3** — must not have a default |
| `DUMMY_HASH` bcrypt literal | `services/auth.service.ts` | Acceptable. Deliberate constant for timing equalisation, contains no secret |
| `"dd_refresh"` cookie name | `auth.controller.ts` | Acceptable, single definition site |
| `/api/v1/admin/auth` cookie path | `app.ts`, `auth.controller.ts` | **L6** — duplicated |
| `http://localhost:3000` / `:5173` | `config/env.ts` | Acceptable as development fallbacks |
| `MAX_FAILED_ATTEMPTS`, `LOCK_DURATION_MS`, `SPAM_THRESHOLD`, `BCRYPT_COST` | 3 files | Acceptable — named constants, not magic numbers. Candidates for config if they ever need tuning per environment |

---

## 7. Phase 0 Regression Check

All re-verified against a running server. No regressions.

| Control | Result |
|---|---|
| `GET /api/contact` removed | 404 |
| `x-powered-by` | absent |
| `X-Frame-Options` | `DENY` |
| HSTS | present |
| CORS rejects unknown origin | 403 |
| Body size limit enforced | yes (but wrong status — **M3**) |
| Rate limiting active | yes, shared across both lead endpoints |
| Legacy 400 / 201 messages | byte-identical |

---

## 8. Recommended Order

Fix before Phase 2 starts, because Phase 2 builds admin screens on top of this layer:

1. **H1** — index migration. Largest blast radius; silently breaks uniqueness guarantees
2. **H2** — `NODE_ENV` handling. Cheap, and it gates three other controls
3. **H3** — `IP_HASH_SALT` required in production
4. **M6** — normalise phone in the migration **while `contacts` is still empty**
5. **M1** — validation message. Conversion path, user-visible
6. **M2** — v1 endpoint field support. Blocks the Quote Requests KPI
7. **M3** — 413 handling

Defer to the Phase 2 change that needs them: **M4** (with the status endpoint) and **M5** (with the user-update endpoint).

Cleanup at any time: **L1–L4** are deletions. **L5–L7** are small refactors.

---

## 9. Method

- Static: full import-graph walk for cycles; export-usage scan for dead code; dependency manifest cross-checked against imports; regex sweep for hardcoded credentials, salts, and duplicated literals.
- Behavioural: live server against Atlas — Phase 0 control re-verification, validation boundary cases, v1 field handling, rate-limit sharing across both mounts, index enumeration on all 7 collections.
- All test records were removed. Final state: 0 leads, 1 superadmin (yours), 1 settings document.
