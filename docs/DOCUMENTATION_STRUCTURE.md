# Documentation Structure

> The permanent documentation hierarchy. Classification is binding: a new
> document must be placed in one of these three tiers when it is created, or
> it does not get created.
>
> Routing by task lives in [PROJECT_INDEX.md](PROJECT_INDEX.md). This document
> defines the *hierarchy*; that one defines *which file for which job*.

---

## 0. The Problem This Solves

30 documents, ~370 KB, against roughly 6,000 lines of application code. The
documentation is larger than the thing it documents.

That is defensible for an architecture-first project, but it has two costs
that are already showing:

1. **Reading cost.** A session that reads broadly burns context before writing
   a line. `CLAUDE.md` already forbids this; the hierarchy below makes the
   forbidden thing unnecessary.
2. **Drift cost.** The same fact recorded in three places goes stale in two of
   them. §4 lists five live instances.

The cap on Core is what keeps this from growing back.

---

## 1. Core Documents — always read (7)

Read before any substantive work. Deliberately capped at seven, total ~72 KB —
of which two are consulted by summary rather than in full.

| # | Document | Size | Answers |
|---|---|---|---|
| 1 | **PROJECT_STATUS.md** | 6K | What is true *now* — phase, capabilities, open work, decisions, risks, next task |
| 2 | **PROJECT_INDEX.md** | 19K | Which document for which task; the codebase map |
| 3 | **CLAUDE_RULES.md** | 3K | Working rules, including the Mongoose safety rules |
| 4 | **ARCHITECTURE.md** | 3K | Stack, layering, current-vs-target. Most cross-referenced document in the project (22 inbound links) |
| 5 | **DESIGN_SYSTEM.md** | 2K | The design freeze and the breakpoint scale. The freeze is a hard rule and is easy to violate accidentally |
| 6 | **MONGOOSE_GOTCHAS.md** | 19K | Verified traps that have caused five bugs. **Read § Summary always; read the body before any query change** |
| 7 | **SECURITY_TODO.md** | 20K | Open security state. **Read § Summary always; read an entry before touching what it covers** |

`CLAUDE.md` at the repository root is loaded automatically every session and
is not counted here. It is the entry point and points at #1 and #2.

**Why these seven and not others.** Each one, if unread, leads to a *wrong
action* rather than merely a slower one: stale state (1), reading the wrong
file (2), breaking a rule (3), wrong stack assumption (4), breaking the design
freeze (5), reintroducing a known query bug (6), reintroducing a known
security gap (7).

**Why 6 and 7 are summary-first.** Both are large registers rather than
narratives. Their summary tables are the always-read part; the bodies are
consulted by section. Any replacement for either must keep a summary at the
top.

---

## 2. Reference Documents — read when relevant (13)

Design and specification. Read the one the task needs; ignore the rest.

| Document | Size | Read when |
|---|---|---|
| API_SPECIFICATION.md | 30K | Adding or changing an endpoint |
| DATABASE_ARCHITECTURE.md | 30K | Schema, collection, index or migration work |
| COMPONENT_ARCHITECTURE.md | 24K | Building or restructuring public-site components |
| PRODUCT_DATA_MODEL.md | 22K | Product, packaging or specification modelling |
| ADMIN_PANEL_SPECIFICATION.md | 21K | What an admin screen must contain; the role matrix |
| SECURITY_ARCHITECTURE.md | 23K | Threat model, controls, PII handling |
| SEO_ARCHITECTURE.md | 18K | Rendering strategy, metadata, Core Web Vitals |
| TESTING_STRATEGY.md | 14K | Writing or running any test |
| RICH_TEXT_EDITOR_DECISION.md | 13K | Anything touching `description` or the allowlist |
| ADMIN_UI_ARCHITECTURE.md | 12K | *How* the admin app is built — stack, auth flow, tokens |
| PHASE_3_PLAN.md | 10K | Planning or executing Phase 3 |
| SEED_DATA.md | 9K | Placeholder values and the launch gate |
| PROJECT_BIBLE.md | 1K | Why the project exists, who buys, success metrics |

---

## 3. Historical Documents — archive (10)

Kept for the record. **Do not read for current state; several are actively
misleading if mistaken for current.**

| Document | Status |
|---|---|
| IMPLEMENTATION_PLAN.md | Superseded by IMPLEMENTATION_ROADMAP. Already banner-marked |
| IMPLEMENTATION_ROADMAP.md | Phases 0–2 are history; Phase 3 superseded by PHASE_3_PLAN. Retains value for Phases 4–5 only |
| CMS_BLUEPRINT.md | Original scope sketch. Superseded by ADMIN_PANEL_SPECIFICATION + DATABASE_ARCHITECTURE |
| FUTURE_DOCS.md | A second document inventory. Superseded by PROJECT_INDEX + this file |
| PHASE_1_REVIEW.md | Findings fixed and recorded |
| PHASE_2C_REVIEW.md | Findings fixed |
| PHASE_2E_SECURITY_REVIEW.md | Findings fixed |
| PHASE_2F_REVIEW.md | Findings recorded |
| PHASE_2F_HANDOVER.md | Frozen snapshot. Already defers to PROJECT_STATUS |
| PHASE_3_READINESS_REPORT.md | **Active until Phase 3 begins**, then historical |

**Phase review documents are never promoted back.** Anything in one that is
still true belongs in PROJECT_STATUS or the relevant reference document; the
review itself is a record of a moment.

---

## 4. Overlapping Responsibilities

Five live duplications. Ordered by risk.

### 4.1 The rich-text allowlist exists in three documents — highest risk

`RICH_TEXT_EDITOR_DECISION.md` §4–5 · `SECURITY_ARCHITECTURE.md` §6 · `PHASE_2F_REVIEW.md` §1

Plus the implementation in `server/src/utils/richText.ts`.

Four copies of a security control. If one is widened and the others are not,
the discrepancy is invisible until it is exploited — and widening the allowlist
is the exact failure mode `SECURITY_TODO.md` S2 warns about.

**Fix:** `RICH_TEXT_EDITOR_DECISION.md` is the single documentary home. The
other two carry a one-line pointer, not a copy. The code is the operational
truth.

### 4.2 PROJECT_INDEX has grown a status section

`PROJECT_INDEX.md` §4 ("Known State") and §5–10 (per-phase "Done" sections)
duplicate `PROJECT_STATUS.md`. The index is 19 KB, and roughly half of it is
state rather than routing.

**Fix:** trim PROJECT_INDEX to routing, the document map, and the codebase
map. Move state to PROJECT_STATUS. Target ~8 KB.

### 4.3 Two document inventories

`FUTURE_DOCS.md` and `PROJECT_INDEX.md` §2 both list every document.

**Fix:** archive FUTURE_DOCS. This file plus PROJECT_INDEX replace it.

### 4.4 The nine security checks appear twice

`SECURITY_ARCHITECTURE.md` §12 and `TESTING_STRATEGY.md` §8.

**Fix:** TESTING_STRATEGY owns them — it is where someone goes to write tests.
SECURITY_ARCHITECTURE references.

### 4.5 Consequence-based testing described twice

`MONGOOSE_GOTCHAS.md` §12 and `TESTING_STRATEGY.md` §1.

**Fix:** TESTING_STRATEGY owns the methodology; MONGOOSE_GOTCHAS keeps only
the Mongoose-specific detection note and references it.

### Minor, acceptable

- `ADMIN_PANEL_SPECIFICATION` (what screens contain) vs `ADMIN_UI_ARCHITECTURE`
  (how the app is built) overlap on design tokens and empty/error states. The
  split is real; deduplicate the token table into ADMIN_UI_ARCHITECTURE only.
- `SEED_DATA` and `PRODUCT_DATA_MODEL` both carry the ISO specification table.
  SEED_DATA owns values; PRODUCT_DATA_MODEL owns structure.
- `PROJECT_BIBLE` restates the goals in `CLAUDE.md`. 1 KB, harmless, kept for
  the buyer profiles and success metrics.

---

## 5. Recommended Merges

| Merge | Into | Why |
|---|---|---|
| FUTURE_DOCS.md | PROJECT_INDEX.md + this file | Third inventory of the same list |
| CMS_BLUEPRINT.md | Already covered by ADMIN_PANEL_SPECIFICATION + DATABASE_ARCHITECTURE | 1 KB scope sketch, fully superseded |
| IMPLEMENTATION_PLAN.md | IMPLEMENTATION_ROADMAP.md | Already banner-marked as superseded |
| PROJECT_INDEX §4–10 | PROJECT_STATUS.md | State does not belong in a routing table |
| Allowlist copies | RICH_TEXT_EDITOR_DECISION.md | §4.1 |
| Security checks | TESTING_STRATEGY.md §8 | §4.4 |

**Net effect:** 30 documents → 27, and the two largest overlaps closed.

---

## 6. Recommended Archives

Archive by **status banner in place**, not by moving files.

The ten documents in §3 have roughly 40 inbound cross-references between them
and the reference tier. Moving them to `docs/archive/` breaks every one of
those links, and a broken link is worse than a correctly-labelled file in a
flat folder. The classification in this document plus a banner on each file
achieves the same outcome with none of the churn.

**Banner format:**

```markdown
> **HISTORICAL.** <one line on what superseded it, with a link.>
> Do not read this for current state — see PROJECT_STATUS.md.
```

Revisit physically moving them only if the count passes ~15, at which point a
one-time link-fixing pass becomes worth it.

---

## 7. Rules for New Documents

1. **Classify on creation.** Core, Reference or Historical. Unclassifiable
   means it does not need to exist.
2. **Core is capped at 7.** Adding one requires removing one, and that trade
   must be argued in the commit message.
3. **One fact, one home.** If it already exists somewhere, link to it. Every
   copy is a future inconsistency.
4. **Phase reviews are Historical from birth.** Anything still true migrates
   to PROJECT_STATUS or a reference document.
5. **A document that describes something not built says so**, in its header.
6. **Update PROJECT_STATUS at the end of every phase.** It is the only
   document with a maintenance obligation.

---

## 8. New Chat Startup Documents

**The exact minimum a new session reads before making any decision.**

| Order | File | Why |
|---|---|---|
| 0 | `CLAUDE.md` (root) | Loaded automatically. Hard rules and entry point |
| 1 | `docs/PROJECT_STATUS.md` | What is true now — phase, capabilities, open decisions, risks, next task |
| 2 | `docs/PROJECT_INDEX.md` | Which document the task needs |
| 3 | `docs/CLAUDE_RULES.md` | Working rules, including Mongoose safety |

**Three files, ~28 KB.** That is the whole startup cost.

Then route via PROJECT_INDEX §1 and read the **one or two** documents it lists
for the task. Nothing else.

### Read additionally, only if the task touches it

| If the task involves | Also read |
|---|---|
| Any database query, repository, session or token | `MONGOOSE_GOTCHAS.md` — mandatory, not optional |
| Anything security-adjacent | `SECURITY_TODO.md` § Summary |
| Any change to `client/` | `DESIGN_SYSTEM.md` § Design Freeze |
| Stack or build questions | `ARCHITECTURE.md` |

### Do not, at startup

- Read all documentation. It is ~370 KB and routes you to the wrong files.
- Read any Historical document for current state.
- Read `PHASE_2F_HANDOVER.md` expecting current state — it is a frozen
  snapshot and says so.
- Re-derive facts already in `PROJECT_STATUS.md` or `PROJECT_INDEX.md`.
