# Phase 3 Readiness Report

> **ACTIVE until Phase 3 begins**, then historical. Classification: [DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md).

> Assessment only. Phase 3 has not started.
> Plan: [PHASE_3_PLAN.md](PHASE_3_PLAN.md) · Status: [PROJECT_STATUS.md](PROJECT_STATUS.md)

**Verdict: not ready.** Three blockers, all cheap to clear. None is engineering work of any size — two are decisions and one is a two-minute owner action.

---

## 1. What Is Ready

| Area | State |
|---|---|
| **Backend architecture** | Controller → Service → Repository throughout. Typed errors, central handler, zod validation, structured logging with PII redaction |
| **Data layer** | 10 collections, indexes declared and synced, migration and reconciliation scripts. `assertIndexes()` refuses to boot without them |
| **Auth and RBAC** | Verified across four roles in both directions. Rotation, reuse detection, lockout, enumeration resistance, password change, session management |
| **Media pipeline** | Cloudinary, magic-byte typing, dedupe, replace, delete guard with a working `usageCount` and a reconciliation script |
| **Catalogue** | Categories and products with a publish gate that blocks placeholder data, returning every blocker at once |
| **Rich text** | Tiptap constrained to the allowlist; server-side sanitisation on write, verified against hostile input posted directly to the API |
| **Admin panel** | Functional for leads, media, catalogue, SEO, profile |
| **Design freeze** | Documented, enforced, and honoured — `client/` has had only defect fixes |
| **Strategy documents** | Rendering, SEO, sections, component architecture and migration mapping all decided and written |
| **Mongoose traps** | Documented, wired into the rules, with an audit command |

The groundwork Phase 3 depends on genuinely exists. The gaps are not in the foundation.

---

## 2. What Is Missing

### Blockers

| # | Missing | Why it blocks |
|---|---|---|
| **B1** | **Prerendering sign-off** | Step 1 of the phase. Building content migration first would be work that has to be redone, and shipping it would be an SEO regression |
| **B2** | **Any automated test** | Phase 3 touches the live conversion path. Three shipped bugs so far returned a plausible response while doing nothing; only consequence-testing caught them. Doing that by hand across eight page migrations is not realistic |
| **B3** | **Seed password not rotated** | Two-minute owner action. It is currently the key to content that will start reaching the public site |

### Gaps that do not block the start

| # | Missing | When it bites |
|---|---|---|
| G1 | Real company address, phone, email | `LocalBusiness` schema and local SEO. Blocks **publication**, not development. External turnaround — request now |
| G2 | Real Certificate of Analysis values | Product publication. Same |
| G3 | Design approval for `/products/:slug` | Step 3E-14. Not needed until then |
| G4 | `/packaging` copy decision — distinct or canonicalised | Step 3D-9 |
| G5 | Logo casing unresolved — "DHUDHAT DEF" became "Dudhat DEF" on every page | Cosmetic but live and unapproved |
| G6 | Six dead footer links | Needs real URLs — same input as G1 |
| G7 | No settings publish gate | Placeholder company details could reach the public site once Phase 3 renders them |
| G8 | CI pipeline | Should follow B2 |

---

## 3. What Should Be Done Before Phase 3 Starts

In order.

**1. Rotate the seed password.** Two minutes, UI exists at `/admin/profile`. Clears B3.

**2. Sign off the prerendering strategy** ([SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §2). Static prerender at build, webhook rebuilds. If you disagree, say so now — it changes the whole phase shape. Clears B1.

**3. Write and run the §8 security checks** from [TESTING_STRATEGY.md](TESTING_STRATEGY.md). Not the whole suite — the nine security checks plus A1–A8. That is the smallest thing that turns "we tested it once by hand" into "a regression is caught". Clears B2.

**4. Request the business inputs** — address, phone, email, Certificate of Analysis. Longest external turnaround, most likely to become the critical path. Clears G1, G2, G6.

**5. Add a settings publish gate** or an equivalent launch check for `[PLACEHOLDER]` values. Small, and closes G7 before Phase 3 makes it reachable.

Items 1–3 are perhaps a day. Item 4 is a message. Item 5 is an hour.

---

## 4. Recommended First Task of Phase 3

**CRA → Vite, with no other change.**

Not prerendering itself, and not any content work.

Reasons:
- The prerender plugin is a Vite plugin, so this is a hard prerequisite.
- It is a **build-configuration change with zero component changes**, which makes it uniquely easy to verify: every page must look identical, and any difference is a build problem rather than a logic problem.
- It is the riskiest infrastructure move in the phase. Doing it alone means a failure is unambiguous. Bundled with prerendering, a broken page could be either.
- It delivers a real improvement even if Phase 3 stalls afterwards.

**Definition of done:** all eight pages build and render pixel-identically at 320 / 640 / 768 / 1024 / 1280 · contact form submits end to end · no new console errors · bundle size recorded as the baseline for later comparison.

**Then** prerendering, and only then any content migration.

---

## 5. Summary

| | |
|---|---|
| **Ready** | Architecture, data layer, auth, media, catalogue, admin panel, and every strategy document Phase 3 depends on |
| **Blocked by** | Prerendering sign-off · no automated tests · unrotated seed password |
| **Watch** | Business inputs with external turnaround — they gate publication, not development, and they are the likeliest critical path |
| **Start with** | CRA → Vite, alone, verified page by page |
