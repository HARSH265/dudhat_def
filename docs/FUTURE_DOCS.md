# Documentation Index

> For **which docs a task needs**, use [PROJECT_INDEX.md](PROJECT_INDEX.md) — it is the routing table.
> This file is the inventory.

## Foundation

| Document | Purpose |
|---|---|
| [PROJECT_INDEX.md](PROJECT_INDEX.md) | Task → document routing; codebase map; known state |
| [PROJECT_BIBLE.md](PROJECT_BIBLE.md) | Vision, goals, target users, success metrics |
| [SEED_DATA.md](SEED_DATA.md) | All placeholder values + launch gate + replacement checklist |
| [CLAUDE_RULES.md](CLAUDE_RULES.md) | Working rules and constraints |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, layering, current vs target |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Design freeze, breakpoints, UI rules |
| [CMS_BLUEPRINT.md](CMS_BLUEPRINT.md) | CMS module scope |

## Architecture

| Document | Purpose |
|---|---|
| [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) | Collections, indexes, migrations |
| [MONGOOSE_GOTCHAS.md](MONGOOSE_GOTCHAS.md) | Verified Mongoose traps — mandatory before query work |
| [RICH_TEXT_EDITOR_DECISION.md](RICH_TEXT_EDITOR_DECISION.md) | Tiptap + sanitize-html; allowlist, sanitisation and rendering strategy |
| [API_SPECIFICATION.md](API_SPECIFICATION.md) | Endpoints, conventions, middleware |
| [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) | Product, packaging variants, specifications |
| [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) | Frontend layers, section renderer, data layer |
| [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) | Admin screens, roles, permissions |
| [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) | Threat model, controls, secrets, PII |
| [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) | Rendering strategy, metadata, Core Web Vitals |
| [SECURITY_TODO.md](SECURITY_TODO.md) | Deferred security items register — S1–S13 |
| [ADMIN_UI_ARCHITECTURE.md](ADMIN_UI_ARCHITECTURE.md) | Admin app build: stack, auth flow, design tokens |

## Execution

| Document | Purpose |
|---|---|
| **[PROJECT_STATUS.md](PROJECT_STATUS.md)** | **Living status — read first in a new session** |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | Consequence-based testing method and checklists |
| [PHASE_3_PLAN.md](PHASE_3_PLAN.md) | Phase 3 execution plan |
| [PHASE_3_READINESS_REPORT.md](PHASE_3_READINESS_REPORT.md) | Phase 3 blockers and first task |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | Phases, dependencies, gates, risk |
| [PHASE_1_REVIEW.md](PHASE_1_REVIEW.md) | Phase 1 exit review — 3 high, 6 medium, 11 low |
| [PHASE_2C_REVIEW.md](PHASE_2C_REVIEW.md) | Phase 2C review — catalogue, publish gate, media usage |
| [PHASE_2E_SECURITY_REVIEW.md](PHASE_2E_SECURITY_REVIEW.md) | S4/S5 — password change, sessions, invalidation strategy |
| [PHASE_2F_REVIEW.md](PHASE_2F_REVIEW.md) | Phase 2F review — CMS admin UI, S1 sanitisation, allowlist |
| **[PHASE_2F_HANDOVER.md](PHASE_2F_HANDOVER.md)** | **Start here in a new session — single source of truth** |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Superseded — original phase intent |

## Not Yet Written

Create only when the work is scheduled.

| Document | Trigger |
|---|---|
| `DEPLOYMENT_GUIDE.md` | Before first production deploy |
| `ANALYTICS_ARCHITECTURE.md` | Phase 3 — when dashboard metrics move beyond counts |
| `CONTENT_MIGRATION_RUNBOOK.md` | Before Phase 3 content cutover |

`USER_ROLE_MATRIX.md` is not needed — the matrix lives in [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §4, next to the screens it governs.
