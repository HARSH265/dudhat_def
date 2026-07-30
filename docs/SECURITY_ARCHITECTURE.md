# Security Architecture

> Status: Planning document. No code written yet.
> Scope: Threat model and controls for the public site, the API, and the admin panel.
> Complements [API_SPECIFICATION.md](API_SPECIFICATION.md) §8, which lists per-endpoint controls. This document covers what that table does not: threat model, secrets, PII, uploads, dependencies, headers, and verification. It does not repeat it.

---

## 1. Current State

Four files constitute the entire security surface: `server/server.js`, `server/config/db.js`, `server/controllers/contactController.js`, `server/routes/contactRoutes.js`.

| Control | Status | Evidence |
|---|---|---|
| Authentication | None | No user model, no middleware, no login |
| Authorisation | None | — |
| Lead data access control | **None** | `contactRoutes.js:6` — `router.get("/", getContacts)` returns every stored lead to any caller |
| CORS | Unrestricted | `server.js` — `app.use(cors())`, all origins |
| Security headers | None | No `helmet` |
| Rate limiting | None | — |
| Input validation | Presence-only | `contactController.js` — four `if (!field)` checks, no format, length, or type validation |
| Input sanitisation | None | `req.body` values flow into `Contact.create` |
| NoSQL injection defence | None | No `mongo-sanitize`, no `sanitizeFilter` |
| Body size limit | None | `express.json()` with no `limit` |
| Error handling | Per-handler | Each `catch` writes its own response; no central handler |
| Request logging | None | — |
| Secrets management | Plaintext file | `server/.env` holds `MONGO_URI`, `JWT_SECRET` |
| Version control | **None** | No `.git` directory exists |
| Dependency scanning | None | — |
| HTTPS enforcement | Not configured | — |
| Response disclosure | Over-discloses | `submitContact` returns the full created document to an anonymous caller |

### Severity ranking

| # | Issue | Severity | Fix cost |
|---|---|---|---|
| 1 | `GET /api/contact` exposes all lead PII unauthenticated | **Critical** | One line |
| 2 | No version control — no history, no review, no rollback | **High** | One command |
| 3 | `JWT_SECRET` and `MONGO_URI` in a plaintext file in `Downloads/` | **High** | Rotate + move |
| 4 | Unrestricted CORS | High | Config |
| 5 | No rate limiting on the public write endpoint | High | Middleware |
| 6 | No validation or sanitisation | High | Validator layer |
| 7 | No security headers | Medium | Middleware |
| 8 | No body size limit | Medium | Config |
| 9 | Full document returned on lead creation | Low | Response shaping |

Issue 1 is the only one that is actively leaking data right now. It is a single-line deletion and should not be sequenced behind anything.

Note on issue 3: `JWT_SECRET` is already present in `.env` despite no authentication existing. Whatever value is there must be treated as compromised — it has sat in plaintext in a user-download directory of unknown provenance — and regenerated when auth is built.

---

## 2. Threat Model

Assets, ranked by what their loss actually costs this business.

| Asset | Where | Impact if lost |
|---|---|---|
| Lead PII (name, email, phone, company) | `leads` collection | Regulatory exposure, competitor access to the sales pipeline, reputational damage with B2B buyers |
| Admin credentials | `users` collection | Full CMS control — content defacement, lead exfiltration |
| Database connection string | Environment | Total compromise |
| Published content integrity | `pages`, `products` | Brand damage; SEO penalty if defaced with spam links |
| Site availability | Infrastructure | Lost leads, which is lost revenue |

### Actors

| Actor | Capability | Primary interest |
|---|---|---|
| Automated scanner / bot | Mass HTTP, known-CVE probing, form spam | Opportunistic — open endpoints, spam injection |
| Competitor | Manual, motivated, patient | The lead list |
| Spammer | Volume form submission | Lead-form abuse to reach the sales inbox |
| Compromised admin session | Full panel access | Data exfiltration |
| Insider (`editor` role) | Legitimate partial access | Over-broad access to data outside their job |

The competitor scenario is not hypothetical for this asset class: an unauthenticated endpoint returning every enquiry with contact details and message body is a complete, current customer pipeline. That is why issue 1 is ranked critical rather than high.

### Trust boundaries

```
Internet  ──►  Public site (client/)          untrusted input
Internet  ──►  Public API /api/v1/*           untrusted input, rate-limited
Internet  ──►  Admin SPA (admin/)             untrusted until authenticated
Admin SPA ──►  Admin API /api/v1/admin/*      authenticated + role-gated
API       ──►  MongoDB                        trusted network, credentialed
API       ──►  Cloudinary                     credentialed, outbound only
```

Everything crossing a boundary left-to-right is validated at the boundary. The API never trusts the admin SPA's role claims — the client hides buttons, the server enforces access.

### Out of scope for v1

Stated so they are not silently assumed: DDoS mitigation beyond rate limiting (a CDN/WAF concern), physical security, supply-chain attestation of npm packages beyond audit + lockfile, and formal penetration testing. The last one is recommended before the panel holds a meaningful lead volume.

---

## 3. Authentication

Token design, endpoints, lockout thresholds, and rotation are specified in [API_SPECIFICATION.md](API_SPECIFICATION.md) §5.1. This section covers only what that does not.

### Password storage

bcrypt, cost factor 12, re-evaluated annually. Argon2id is the stronger choice and is preferred if the deployment target supports the native build cleanly; bcrypt is the fallback because a broken native dependency on a shared host is a worse outcome than a slightly weaker KDF.

### Password policy

Minimum 12 characters. No composition rules — mandated symbol classes produce `Password1!` and nothing else. Checked against the top-10k common-password list on set and on change. Rejected on match with a specific message, because a generic "invalid password" during a *set* operation is just confusing.

### Session invalidation

Access tokens are stateless, so revocation is not immediate. Mitigations: 15-minute TTL caps the window; `passwordChangedAt` on the user is compared against the token's `iat`, invalidating every token issued before a password change; refresh tokens are stateful and revoked immediately.

The events that revoke all of a user's refresh tokens: password change, password reset, account deactivation, role change, and detected refresh-token reuse.

### Refresh token reuse detection

A rotated token that is presented again means the token was captured. Response: revoke the entire token chain for that user, force re-login, write an audit record. False positives occur on a race between two tabs — accepted, because the cost is one re-login and the alternative is ignoring a live indicator of theft.

---

## 4. Authorisation

The role matrix is in [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §4. Implementation rules:

1. **Deny by default.** The admin router applies `authenticate` at mount, not per-route. A new route added without a role gate is inaccessible, not open — the failure mode of forgetting is lockout, never exposure.
2. **Authorisation is server-side only.** Hidden UI is presentation. Every admin endpoint calls `authorize(...roles)`.
3. **Object-level checks are separate from route-level checks.** `sales` may read leads (route-level) but the service still verifies scope where a rule exists. Route-level permission is not object-level permission — this is the most commonly skipped control in an admin panel.
4. **Role is read from the token, never from the request body.** A `role` field in a request payload is ignored, and its presence is logged as a tampering signal.
5. **Privilege escalation guards** (from [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §5.13): no self-role-change; the last active `superadmin` cannot be demoted, deactivated, or deleted.

---

## 5. Secrets Management

### Immediate actions

1. **Initialise git before anything else is written.** No repository exists. `.gitignore` already lists `.env`, so initialising now keeps secrets out of history permanently — initialising after a careless `git add .` does not.
2. **Rotate `MONGO_URI` credentials and regenerate `JWT_SECRET`.** Both have sat in plaintext outside version control in a download directory.
3. **Populate `.env.example`** — it is currently a zero-byte file. Key names only, never values. The full key list is in [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §7.

### Rules

| Rule | Detail |
|---|---|
| Never in code | No secret literal in any `.js` file |
| Never in the client bundle | `REACT_APP_*` / `VITE_*` are public by construction. Only `API_URL` and analytics IDs qualify |
| Never in logs | Structured logger has a redaction list: `password`, `token`, `authorization`, `cookie`, `mongo_uri`, `secret` |
| Never in error responses | Central error handler emits generic text on 500; details go to the log with a `requestId` |
| Separate per environment | Development, staging, and production never share a database or a JWT secret |
| Startup validation | The server validates required env vars at boot and exits with a named error listing what is missing — not a `TypeError` 40 lines later |

### JWT secret requirements

Distinct secrets for access and refresh tokens (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`), each ≥ 32 bytes from a CSPRNG. Not a passphrase. Rotation invalidates all sessions, which is acceptable for a handful of admin users and should be done annually.

---

## 6. Input Handling

### Validation

Every endpoint with a body, param, or query gets a schema, applied as middleware before the controller. Unknown fields are **stripped, not passed through** — this is what stops mass assignment. A client sending `{ name, email, role: "superadmin" }` to a user-update endpoint has `role` removed by the validator, not merely ignored by the service.

Validation runs before authorisation where it is cheap, so malformed requests are rejected without a database round-trip.

### NoSQL injection

The current `contactController` passes `req.body` values directly into a Mongoose call. Under a query operation, `{ email: { $gt: "" } }` matches everything. Three layers:

1. `express-mongo-sanitize` strips keys containing `$` or `.` from body, query, and params.
2. `mongoose.set('sanitizeFilter', true)` wraps query values in `$eq` at the driver level.
3. Validators enforce primitive types — an `email` field typed as String rejects an object outright.

Any one would mostly do; all three are used because the failure is silent and total.

### XSS

The rich-text `description` on products and the `richText` section type are the only fields accepting HTML. Both are sanitised **on write** against an allowlist: `p, br, strong, em, u, ul, ol, li, a, h2, h3, h4, blockquote`, with `a` limited to `href`, `title`, `rel`, and `href` restricted to `http`, `https`, `mailto`, `tel`. Everything else is stripped — no `script`, `style`, `iframe`, `on*`, `javascript:` or `data:` URLs.

Sanitising on write rather than on render means the database never holds an attack payload, so a future consumer that forgets to escape is not immediately vulnerable. Rendering still escapes; `dangerouslySetInnerHTML` is permitted only for these sanitised fields and nowhere else.

All other content fields are plain text and React escapes them by default.

### Lead form abuse

Layered, in order of cost:

| Layer | Mechanism | Cost to attacker |
|---|---|---|
| Honeypot | Hidden `website` field must be empty; non-empty is accepted with a 200 and discarded | Zero-friction for users, stops naive bots |
| Timing | Submissions under 3 seconds from page load are scored as suspicious | Low |
| Rate limit | 5/IP/hour, 3/email/hour, 20/IP/day | Medium |
| Content heuristics | URL count in `message`, known spam phrases, non-Latin-script mismatch | Medium |
| Duplicate detection | Same email within 24h flagged, never blocked | — |

Spam is **flagged, never rejected**. A false positive that silently discards a real enquiry costs a customer; a false positive that files one under a Spam tab costs a click. Scores land in `leads.spamScore` and the admin panel exposes the Spam view.

CAPTCHA is deliberately not used at this stage. It adds measurable friction to a B2B conversion form, and the layers above handle the volume a site of this size attracts. Revisit if flagged-spam volume exceeds roughly 20% of submissions.

---

## 7. File Upload Security

Constraints (size caps, MIME allowlist, magic-byte detection, checksum dedupe) are in [API_SPECIFICATION.md](API_SPECIFICATION.md) §5.7. The reasoning behind the non-obvious ones:

**Magic bytes, not extension or `Content-Type`.** Both are client-supplied. A file named `logo.png` with a `image/png` header can be a PHP script or an HTML document containing script; if it is served from a domain that also holds a session cookie, that is stored XSS.

**SVG is sanitised, not merely allowlisted.** SVG is XML and executes script. It is allowed because logos need it, and it is stripped of `script`, `foreignObject`, event handlers, and external references before storage. If sanitisation cannot be done reliably, the correct move is to drop SVG from the allowlist rather than accept it unsanitised.

**Nothing touches the API server's disk.** Files stream to Cloudinary. No temp directory to fill, no path traversal via filename, no leftover files.

**Filenames are regenerated server-side.** The client-supplied name is stored as a display label only. It never reaches a filesystem path or a URL.

**Uploads are authenticated and role-gated.** There is no public upload path — a lead form does not accept attachments in v1. If that changes, it becomes the single highest-risk endpoint on the site and needs separate design.

---

## 8. Data Protection & PII

Lead records are the sensitive asset. Handling rules beyond what [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.7 specifies:

| Concern | Rule |
|---|---|
| IP addresses | Salted hash only. The raw IP is used in-request for rate limiting and discarded. It is personal data with no retention justification once the lead exists |
| Analytics identity | `pageviews.sessionHash` is a salted hash of IP + UA + date. No cross-day tracking, no identity |
| Lead deletion | Soft delete only, `superadmin` only. Leads are business records |
| Bulk export | The highest-egress action in the panel. Audit-logged with row count and filter set, rate-limited to 5/hour, confirmation dialog states the row count |
| Log content | Lead field values never enter application logs. Lead IDs may |
| Backups | Encrypted at rest; access restricted to the same people who hold production database credentials |
| Third-party transfer | None. Lead data goes to MongoDB and the notification email recipients only. No CRM integration, no analytics platform |
| Retention | No policy set — see [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §10, open question 3 |

**Notification emails carry lead PII to an inbox outside the system's control.** That is the one unavoidable egress, and it is why the recipient list is a `superadmin`/`admin`-only setting rather than a per-user preference.

**On regulatory scope:** the site targets Indian B2B buyers, so India's DPDP Act is the relevant regime rather than GDPR — though EU enquiries are possible and the controls above (minimisation, hashing, soft delete, audit) are the ones both regimes ask for. Formal compliance sign-off is a legal question, not an architectural one, and is flagged rather than answered here.

---

## 9. Transport & Headers

HTTPS everywhere; HTTP redirects to HTTPS at the edge. Cookies are `Secure`, `HttpOnly`, `SameSite=Strict`, path-scoped to `/api/v1/admin/auth`.

Headers via `helmet`, plus an explicit CSP:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |

### Content Security Policy

The current site loads Google Fonts from `fonts.googleapis.com` / `fonts.gstatic.com` (`client/public/index.html`), and the target adds Cloudinary and an analytics provider. Starting policy:

```
default-src 'self'
script-src   'self'
style-src    'self' 'unsafe-inline' https://fonts.googleapis.com
font-src     'self' https://fonts.gstatic.com
img-src      'self' data: https://res.cloudinary.com
connect-src  'self' <API_ORIGIN>
frame-ancestors 'none'
base-uri     'self'
form-action  'self'
object-src   'none'
```

`style-src 'unsafe-inline'` is required by CRA's inlined critical CSS and by the `style={{ backgroundImage }}` in `Home.jsx`. It is a real weakening and should be removed via nonces once the site moves to Vite. Self-hosting the Poppins font removes two external origins and improves LCP at the same time — recommended, and noted in [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §6.

CSP ships in `Report-Only` for one week before enforcement. A CSP that breaks the contact form is a lead-generation outage.

---

## 10. Dependency & Build Security

| Control | Detail |
|---|---|
| Lockfiles | `package-lock.json` committed for both apps; `npm ci` in CI and production, never `npm install` |
| Audit | `npm audit --audit-level=high` in CI, failing the build |
| Update cadence | Monthly patch review; security advisories actioned within a week |
| `react-scripts@5.0.1` | Carries known transitive advisories, most in build-time-only paths. The Vite migration resolves the class of issue rather than chasing individual overrides |
| Source maps | Not published to production |
| `NODE_ENV=production` | Required in production — Express leaks stack traces in views and error output otherwise |
| Server tokens | `x-powered-by` disabled |

---

## 11. Logging, Audit & Monitoring

**Application logs** (structured JSON): request ID, method, path, status, duration, user ID for admin routes. Never: request bodies, tokens, passwords, lead field values.

**Audit log** (`activitylogs`, per [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §5.11): every admin mutation, plus login, logout, and failed login. Field-level diffs from an explicit per-entity allowlist, so `passwordHash` cannot land in a diff.

**Security events warranting an alert:** ≥ 10 failed logins for one account in 15 minutes; refresh-token reuse; a lead export over 500 rows; any 5xx rate above baseline; a role change; deactivation of a `superadmin`.

**Retention:** application logs 30 days, audit log 365 days (TTL-enforced), security alerts 365 days.

---

## 12. Verification

Controls that are not tested are assumptions. Minimum checks before production:

| Check | Method |
|---|---|
| No unauthenticated access to lead data | Automated test: every `/admin/*` route without a token returns 401 |
| Role enforcement | Automated test per route × per role, asserting 403 for disallowed pairs |
| Mass assignment | Test: `role` in a user-update body does not change the role |
| NoSQL injection | Test: `{ "$gt": "" }` in a lead query param returns 400, not a result set |
| XSS | Test: `<script>` in a product description is stripped on write |
| Rate limiting | Test: the 6th lead submission in an hour returns 429 |
| Upload type bypass | Test: a renamed `.html` file with a `.png` extension is rejected |
| Secrets in bundle | Grep the production build for `SECRET`, `MONGO`, `PASSWORD` |
| Headers | Automated check of the header table in §9 against a deployed response |

These belong in `TESTING_STRATEGY.md` when it is written; they are listed here so the security requirements exist before the test plan does.

---

## 13. Build Order

| Phase | Security work |
|---|---|
| **0** | Remove `GET /api/contact`; initialise git; rotate secrets; populate `.env.example` |
| **1** | Helmet, CORS allowlist, body limits, rate limiting, validation layer, sanitisation, central error handler, structured logging, auth + RBAC, audit log |
| **2** | Upload security, lead PII controls, export auditing, spam scoring |
| **3** | CSP enforcement, security event alerting, dependency automation |
| **4** | External penetration test |

Phase 0 is roughly an hour of work and closes the only live data leak. Nothing in Phase 1 should start before it is done.
