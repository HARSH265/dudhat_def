# Dudhat DEF

MERN brochure site being converted into a CMS-driven lead generation platform.
`client/` React (CRA) · `server/` Express + MongoDB · `docs/` architecture.

---

## Start Here

1. Read `docs/PROJECT_INDEX.md` — routing table for which docs a task needs.
2. Read only what it lists. Usually 1–2 files.
3. Do not read all documentation. Do not explore the codebase to build context.

`docs/PROJECT_INDEX.md` §4 holds established facts about the current state. Trust them rather than re-deriving.

---

## Goals

Product showcase · Lead generation · Inquiry management.

Every page pushes toward: Request Quote · Contact Us · Call Now · WhatsApp Inquiry.

---

## Hard Rules

**Design is frozen.** The existing visual design is approved. No redesign, no rebrand, no new UI elements. Permitted without approval: responsive fixes, accessibility fixes, performance work, and refactors that are visually identical. Anything that changes a pixel needs approval first. Full policy: `docs/DESIGN_SYSTEM.md` § Design Freeze.

**The contact form must never break.** `ContactForm.jsx` → `POST /api/contact` is the site's only conversion path. It fails silently — no error surfaces, leads just stop. Any change to it ships behind the legacy alias in `docs/API_SPECIFICATION.md` §9.

**No hardcoded content.** Content comes from the CMS, settings, or `lib/constants.js`.

**No duplicated code.** Four page-level patterns are already duplicated across seven files. Do not add a fifth.

**No business logic in controllers.** Controller → Service → Repository. Controllers handle requests; services hold logic; repositories touch the database.

**Read `docs/MONGOOSE_GOTCHAS.md` before any repository, query, session or token change.** It documents verified Mongoose traps that have already caused production-risk bugs here — one cause produced three separate incidents. Rules: `docs/CLAUDE_RULES.md` § Mongoose Safety Rules.

**No secrets in code, logs, error responses, or the client bundle.**

**Placeholder data must not reach production.** All dummy values live in `docs/SEED_DATA.md` and are marked `[PLACEHOLDER]`. The launch gate is in that file.

---

## Before Implementing

State the approach, name the impacted files, then change only those. Do not refactor adjacent code that was not part of the task.

---

## Token Efficiency

This repo has 39,580 files in `node_modules` and 8.3MB of images. Unfiltered searching is the main cost driver. `.ignore` and `.claude/settings.json` exclude both.

### Rules

**Route, don't explore.** `docs/PROJECT_INDEX.md` §3 maps every source file to its purpose. Use it instead of Glob-then-Read to find things.

**Never read whole large files.** `App.css` is 888 lines — Grep for the class, then Read with `offset`/`limit`. Same for any file over ~300 lines. Never read `package-lock.json`, `node_modules/**`, or image files.

**Grep before Read.** Locate the symbol first, read the region around it. Reading a file to find out whether it contains something is backwards.

**Scope every search.** Pass `path` and `glob` to Grep. `Grep(pattern, path="client/src", glob="*.jsx")` — not a bare repo-wide pattern.

**Prefer `files_with_matches`.** Use `output_mode: "content"` only once the file list is narrowed.

**Batch independent calls.** Multiple reads or searches with no dependency between them go in one message.

**Do not re-read after editing.** Edit and Write error on failure; a successful edit needs no verification read.

**Do not re-establish known facts.** The stack, the security issue, the rule violations, and the data defects are recorded in `docs/PROJECT_INDEX.md` §4. Re-investigating them is pure cost.

**Delegate wide searches.** A question spanning many files goes to an Explore subagent, which returns the conclusion instead of the file contents.

**One task, one context.** Finish a task before starting an unrelated one. Mixed context carries the first task's files through the second.

### Anti-patterns

| Don't | Do |
|---|---|
| Read all 15 docs before starting | Read the 1–2 the routing table lists |
| `Glob("**/*.jsx")` then read each | Look up the file in `PROJECT_INDEX.md` §3 |
| Read `App.css` to change one class | Grep the class, read that block |
| Re-read a file to confirm an edit landed | Trust the tool result |
| Explore to "understand the codebase" | It is already documented — read the index |
| Repeat findings across documents | Cross-reference by section number |

---

## Current State — Quick Facts

Client: CRA (not Vite), no React Query, content hardcoded in all 8 pages. **Untouched so far.**
Server: TypeScript, `src/` → `dist/`, Controller → Service → Repository, JWT auth + RBAC, 7 collections.
Neither: Cloudinary, tests, admin panel.

**Phase 0 and Phase 1 are complete** — see `docs/PROJECT_INDEX.md` §5–7. Next is Phase 2 (admin panel, media, catalogue, lead management) in `docs/IMPLEMENTATION_ROADMAP.md`.
