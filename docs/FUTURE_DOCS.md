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
| [API_SPECIFICATION.md](API_SPECIFICATION.md) | Endpoints, conventions, middleware |
| [PRODUCT_DATA_MODEL.md](PRODUCT_DATA_MODEL.md) | Product, packaging variants, specifications |
| [COMPONENT_ARCHITECTURE.md](COMPONENT_ARCHITECTURE.md) | Frontend layers, section renderer, data layer |
| [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) | Admin screens, roles, permissions |
| [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) | Threat model, controls, secrets, PII |
| [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) | Rendering strategy, metadata, Core Web Vitals |

## Execution

| Document | Purpose |
|---|---|
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | Phases, dependencies, gates, risk |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Superseded — original phase intent |

## Not Yet Written

Create only when the work is scheduled.

| Document | Trigger |
|---|---|
| `TESTING_STRATEGY.md` | Before Phase 2 — needed once services carry business logic |
| `DEPLOYMENT_GUIDE.md` | Before first production deploy |
| `ANALYTICS_ARCHITECTURE.md` | Phase 3 — when dashboard metrics move beyond counts |
| `CONTENT_MIGRATION_RUNBOOK.md` | Before Phase 3 content cutover |

`USER_ROLE_MATRIX.md` is not needed — the matrix lives in [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §4, next to the screens it governs.
