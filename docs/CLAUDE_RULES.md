# Claude Rules

Before every task:
1. Read `PROJECT_INDEX.md` and only the documents it routes you to.
2. Analyze existing code.
3. Preserve architecture.
4. Preserve design consistency.

> Rule 1 replaces "read all docs". Reading everything costs ~150KB of context
> and routes you to the wrong files. See `PROJECT_INDEX.md` §1.

Project Goals:
- Lead Generation
- Product Showcase
- CMS Driven Content

Rules:
- No hardcoded content
- Mobile First
- SEO First
- Secure APIs
- Reusable components

When implementing:
- Explain approach first
- Mention impacted files
- Generate only required changes

Never:
- Duplicate code
- Break API contracts
- Put business logic in controllers

---

## Mongoose Safety Rules

Before modifying **repositories, services, authentication, sessions, tokens,
or any database query**:

- Review `MONGOOSE_GOTCHAS.md`
- Follow the documented safe patterns
- Verify operator behaviour on typed paths
- Verify `sanitizeFilter` interactions
- Use the documented safe query patterns
- Do not introduce query operators on typed paths without verification
- Do not bypass documented Mongoose safeguards

### Non-negotiable

**Every query operator in a filter is wrapped in `mongoose.trusted()`**
unless the query is `countDocuments` or an aggregation — and relying on those
two exceptions is how the bug comes back. `$gt`, `$gte`, `$lt`, `$ne`, `$in`,
`$exists`, `$regex` all throw a cast error on `find`, `findOne`, `updateOne`,
`updateMany`, `findOneAndUpdate`, `deleteMany` and `distinct`.
`MONGOOSE_GOTCHAS.md` §1.

**User input never reaches `$regex` unescaped.** §2.

**`unique: true` enforces nothing without an index.** New models go in
`src/models/index.ts`, or `sync:indexes` and the startup assertion both miss
them. §3.

**Counters use `$inc`; sequences use an atomic counter document.** Never
read-modify-write, never `countDocuments() + 1`. §8.

**`findOneAndUpdate` needs `{ new: true, runValidators: true }`.** §6, §7.

### Verify the consequence, not the response

Three shipped bugs returned a plausible response while doing nothing: reuse
detection that never revoked, a unique constraint that never existed, and a
lost counter update. A test asserting "the endpoint returned an error" passes
all three.

For anything touching tokens, sessions, counters or uniqueness, assert the
resulting **state**, not the status code. `MONGOOSE_GOTCHAS.md` §12.

### After any repository change

Run the audit in `MONGOOSE_GOTCHAS.md` § Audit command. Every hit must be
inside `countDocuments`, inside an aggregation, or wrapped in
`mongoose.trusted()`. Anything else is a latent 500.
