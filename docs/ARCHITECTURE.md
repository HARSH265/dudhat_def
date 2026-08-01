# Architecture

> This document states the **target** stack. Current state differs — see the Current vs Target table below.

## Frontend — Public Site (`client/`)
- React
- Vite
- Javascript
- React Query
- Framer Motion
- CSS Modules + `variables.css` tokens

**Not Tailwind. Not Shadcn UI.** Both were previously listed here for the public site. Shadcn UI carries its own visual identity (palette, radii, control styling), and a Tailwind rewrite of 888 lines of working CSS risks visual regression on every page. The public design is frozen — see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Styling stays token-driven CSS.

## Frontend — Admin Panel (`admin/`)
- React
- Vite
- **TypeScript** (changed from JavaScript in Phase 2D — the API surface is
  40+ endpoints across 10 models, and untyped response handling would be a
  steady source of runtime bugs. The server is TypeScript; sharing shapes
  across a language boundary means maintaining them twice)
- TanStack Query
- Tailwind
- Shadcn UI

Build detail: [ADMIN_UI_ARCHITECTURE.md](ADMIN_UI_ARCHITECTURE.md).

Tailwind and Shadcn apply **here only**. The admin panel is a new surface with no approved design to preserve, so an off-the-shelf component system is the right call.

## Backend
- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose

## Database Layer

- MongoDB + Mongoose
- Controller → Service → Repository; only repositories issue queries
- Schemas, indexes and migrations: [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md)
- **Query safety: [MONGOOSE_GOTCHAS.md](MONGOOSE_GOTCHAS.md) — mandatory reading before any repository, session, token or query change.** It documents verified Mongoose behaviours that have already produced production-risk bugs in this codebase, including three separate incidents from one cause. Enforced by [CLAUDE_RULES.md](CLAUDE_RULES.md) § Mongoose Safety Rules.

Runtime settings applied in `src/config/db.ts` before models load:
`strictQuery: true`, `sanitizeFilter: true`, `autoIndex` off in production.
Each has a documented consequence — see MONGOOSE_GOTCHAS §1 and §3.

## Storage
- Cloudinary

## Current vs Target

| Concern | Target | Current |
|---|---|---|
| Build tool | Vite | CRA (`react-scripts@5.0.1`) |
| Backend language | TypeScript | JavaScript (CommonJS) |
| Data fetching | React Query | `axios` inline in `ContactForm.jsx` |
| Layering | Controller → Service → Repository | Controller → Model, directly |
| Media storage | Cloudinary | Local files in `client/src/assets/images` |
| Rendering | See [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §2 | Client-side only, no head management |
| Version control | Git | **None — no repository initialised** |

## Rendering Strategy

Not previously specified, and it is the decision that governs whether the SEO-first goal is achievable. Decided in [SEO_ARCHITECTURE.md](SEO_ARCHITECTURE.md) §2.

## Architecture Pattern

Browser
-> React App
-> API
-> Controller
-> Service
-> Repository
-> MongoDB

## Rules

Controllers:
- Request handling only

Services:
- Business logic

Repositories:
- Database operations

Never place business logic inside controllers.