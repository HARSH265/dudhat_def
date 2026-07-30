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
- Javascript
- React Query
- Tailwind
- Shadcn UI

Tailwind and Shadcn apply **here only**. The admin panel is a new surface with no approved design to preserve, so an off-the-shelf component system is the right call.

## Backend
- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose

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