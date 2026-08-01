# Mongoose Gotchas

> **Permanent engineering reference.** Not a changelog, not a post-mortem archive.
> Every entry documents a Mongoose behaviour that has already produced a production-risk bug in this codebase.
>
> **Read before touching** repositories, services, authentication, sessions, tokens, or any database query.
> Rules: [CLAUDE_RULES.md](CLAUDE_RULES.md) § Mongoose Safety Rules.

Every behaviour below was verified empirically against this project's exact Mongoose configuration (`strictQuery: true`, `sanitizeFilter: true`, set in `src/config/db.ts` before models load). Where a claim is version-specific it says so.

---

## Summary — the five rules

1. **Any query operator in a filter needs `mongoose.trusted()`** — except in `countDocuments` and aggregation, and relying on those exceptions is how the bug returns.
2. **`unique: true` is an index directive, not a validator.** No index, no uniqueness.
3. **`select: false` fields are silently `undefined`** unless explicitly selected.
4. **Update validators do not run** unless you ask for them.
5. **Verify the consequence, not the response.** Three of the incidents below returned a plausible-looking result while doing nothing.

---

## §1 — `sanitizeFilter` breaks query operators on typed paths

**The single highest-value entry in this file. It has caused three separate incidents.**

### Description

`mongoose.set("sanitizeFilter", true)` defends against NoSQL operator injection: if a request body supplies `{ email: { $gt: "" } }`, Mongoose wraps the value in `$eq` so it is treated as a literal rather than an operator.

It cannot distinguish attacker-supplied operators from application-authored ones. Wrapping an intentional `{ $gt: someDate }` produces `{ $eq: { $gt: someDate } }`, and Mongoose then tries to cast the object `{ $gt: … }` against the path's declared type — which throws.

### Incorrect assumption

> "`sanitizeFilter` only affects values that came from user input."

and, worse:

> "I tested the operator and it worked, so the pattern is safe."

### Actual behaviour

The wrapping is applied **per query method**, not per filter. Verified on this project's Mongoose version:

| Method | Raw operator | With `mongoose.trusted()` |
|---|---|---|
| `countDocuments` | **OK** | OK |
| `find` | **CAST FAIL** | OK |
| `findOne` | **CAST FAIL** | OK |
| `updateOne` | **CAST FAIL** | OK |
| `updateMany` | **CAST FAIL** | OK |
| `findOneAndUpdate` | **CAST FAIL** | OK |
| `deleteMany` | **CAST FAIL** | OK |
| `distinct` | **CAST FAIL** | OK |
| `aggregate` `$match` | **OK** (no casting at all) | n/a |

`countDocuments` and `aggregate` being exempt is the trap. A developer writes `{ createdAt: { $gte: x } }` in a count query, sees it work, and reasonably concludes the codebase tolerates raw operators. It does not — it tolerates them in exactly two places.

The failure is **not** operator-specific or type-specific. `$gt`, `$gte`, `$lt`, `$ne`, `$in`, `$exists`, `$regex` all fail equally on Date, String, Number, ObjectId and Boolean paths once they reach `find` or an update.

`$or` / `$and` branches are cast against their paths exactly like a top-level filter, so operators nested inside them need the same treatment.

### Real bugs caused

**Incident A — refresh-token reuse detection never revoked anything (Phase 1C).**
`revokeAllForUser` filtered `{ userId, revokedAt: { $exists: false } }` through `updateMany`. Every call threw a cast error. Reuse detection *appeared* to work — the endpoint returned an error to the caller — but **the chain was never revoked**. A stolen refresh token would have kept working indefinitely, which is the exact scenario the control exists to stop.

**Incident B — session listing returned a 500 (Phase 2E).**
`listActiveForUser` filtered `{ expiresAt: { $gt: new Date() } }` through `find`. `GET /admin/auth/sessions` failed outright.

**Incident C — three live query bugs found while writing this document.**
An audit for the same pattern found three more, all shipped and all returning 500:

| Endpoint | Filter | Method |
|---|---|---|
| `GET /admin/categories?search=` | `{ name: { $regex, $options } }` | `find` |
| `GET /admin/leads?from=&to=` | `{ createdAt: { $gte, $lte } }` | `find` |
| `GET /admin/media?missingAlt=true` | `$or: [{ alt: { $exists: false } }, …]` | `find` |

The lead date-range filter is the notable one: it is a documented, user-facing feature that had never worked.

### How it was detected

**A** — by testing the *consequence*. The reuse test asserted that presenting a rotated token returned an error (it did) **and** that the successor token was subsequently dead (it was not). Asserting only the response would have passed.

**B** — a 500 during manual endpoint testing.

**C** — deliberate grep audit while writing this file, then empirical confirmation of each hit. Not by any test.

### Correct pattern

Wrap every application-authored operator in `mongoose.trusted()`. It marks the object as coming from code rather than a request, so `sanitizeFilter` leaves it alone while still protecting genuinely untrusted input elsewhere in the same filter.

Where an operator can be avoided entirely, prefer that — `revokedAt: null` matches both `null` and a missing field, and needs no escape hatch.

### Unsafe

```ts
// Throws on find/update. "Works" on countDocuments, which is how it survives review.
async listActive(userId: Types.ObjectId) {
  return RefreshToken.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },      // CAST FAIL
  });
}

async revokeAll(userId: Types.ObjectId) {
  return RefreshToken.updateMany(
    { userId, revokedAt: { $exists: false } },   // CAST FAIL — silently no-ops the control
    { $set: { revokedAt: new Date() } }
  );
}

if (q.search) filter.name = { $regex: q.search, $options: "i" };  // CAST FAIL + regex injection
```

### Safe

```ts
import mongoose from "mongoose";

async listActive(userId: Types.ObjectId) {
  return RefreshToken.find({
    userId,
    revokedAt: null,                                    // no operator needed
    expiresAt: mongoose.trusted({ $gt: new Date() }),   // explicit escape hatch
  });
}

async revokeAll(userId: Types.ObjectId) {
  // `revokedAt: null` matches null AND missing — simpler than $exists and
  // needs no trusted() at all.
  return RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

if (q.search) {
  filter.name = mongoose.trusted({ $regex: escapeRegex(q.search), $options: "i" });
}
```

> `$set`, `$inc`, `$unset`, `$push` and the rest of the **update** document are unaffected — `sanitizeFilter` touches filters only.

---

## §2 — User input must never reach `$regex` unescaped

### Description

Search boxes feed `$regex`. A regex is code.

### Incorrect assumption

> "It is only a search string."

### Actual behaviour

Mongoose passes the pattern through to MongoDB unmodified. Two consequences:

- **Malformed input is a 500.** `(((` is not a valid pattern.
- **Crafted input is a denial of service.** `(a+)+$` is catastrophic backtracking; MongoDB evaluates it per document, on a collection scan.

### Real bug caused

Shipped in `categoryRepository.list` (Phase 2C), found in the §1 audit. It was already broken by the cast error, so the regex hazard was never reached — one bug masking another.

### How it was detected

Reading the fix for the cast error and noticing the value was user input.

### Correct pattern

Escape before interpolating. Prefer a `text` index for real search — that is what the text indexes on `leads` and `products` are for. `$regex` is acceptable for small collections where a text index is not worth the write cost.

### Unsafe

```ts
filter.name = { $regex: q.search, $options: "i" };
```

### Safe

```ts
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

filter.name = mongoose.trusted({ $regex: escapeRegex(q.search), $options: "i" });
```

---

## §3 — `unique: true` is an index directive, not a validator

### Description

Declaring `unique: true` on a schema path reads like a constraint. It is an instruction to *build an index*.

### Incorrect assumption

> "The schema says unique, therefore duplicates are impossible."

### Actual behaviour

Uniqueness is enforced by the **index**, in the database. Mongoose performs no application-level check. If the index does not exist, `unique: true` enforces nothing at all — writes succeed and duplicates accumulate silently.

Compounding this: `autoIndex` is disabled in production (`src/config/db.ts`), because building indexes on boot is a production hazard. So in production, **no index exists unless something explicitly creates it**.

### Real bug caused

Phase 1 exit review, finding H1. The first production deploy would have run with **zero indexes across all collections**. Consequences beyond slow queries:

- `leads.leadNumber` — duplicate lead numbers possible
- `users.email` — two accounts could share an email; login becomes ambiguous
- `refreshtokens.expiresAt` TTL — expired tokens never reaped
- `activitylogs.createdAt` TTL — the 365-day audit retention silently never happens

Indexes existed in development purely because `autoIndex` is on there.

### How it was detected

Reading `db.ts` during the Phase 1 exit review and asking what `autoIndex: !isProduction` implies for the `unique` declarations.

### Correct pattern

An explicit, idempotent index migration in the deploy pipeline, plus a startup assertion that refuses to boot when declared indexes are missing. Both exist: `npm run sync:indexes` and `assertIndexes()` in `src/config/db.ts`.

A new model must be registered in `src/models/index.ts` or **both** miss it.

### Unsafe

```ts
// production: no index, no uniqueness, no TTL
mongoose.set("autoIndex", !isProduction);
// ...and nothing else creates them
```

### Safe

```ts
mongoose.set("autoIndex", !isProduction);

// Deploy step, before the server starts:
for (const model of Object.values(MODELS)) await model.syncIndexes();

// Boot: fail loudly rather than run unconstrained
await assertIndexes();
```

---

## §4 — Soft delete breaks unique indexes

### Description

Soft-deleted rows keep their values, including the ones a unique index covers.

### Incorrect assumption

> "The record is deleted, so its slug is free."

### Actual behaviour

A plain unique index sees the soft-deleted row. Its slug stays reserved forever, and creating a replacement fails with a duplicate-key error.

### Real bug caused

Caught in design rather than production, during Phase 2C.

### Correct pattern

A **partial** unique index scoped to live rows.

### Unsafe

```ts
categorySchema.index({ slug: 1 }, { unique: true });
```

### Safe

```ts
categorySchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
```

---

## §5 — `select: false` fields are silently absent

### Description

`passwordHash` is declared `select: false` so it never leaks into a response by accident.

### Incorrect assumption

> "`findById` returns the document, so `user.passwordHash` is there."

### Actual behaviour

It is `undefined`. No error, no warning. `bcrypt.compare(plain, undefined)` resolves `false` rather than throwing, so the symptom is **"the correct password is rejected"** — which reads as a password bug, not a query bug.

### Real bug caused

Avoided by explicit repository methods, but it is the natural mistake: `findByEmail` and `findByEmailWithPassword` exist as separate methods precisely so the selecting variant is a deliberate act.

### Correct pattern

Separate repository methods. Never add `+passwordHash` inline at a call site — that spreads the sensitive projection across the codebase.

### Unsafe

```ts
const user = await User.findOne({ email });
await bcrypt.compare(password, user.passwordHash);   // undefined -> always false
```

### Safe

```ts
async findByEmailWithPassword(email: string) {
  return User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
}
```

---

## §6 — Update validators do not run by default

### Description

`findOneAndUpdate` and `updateOne` skip schema validation unless asked.

### Incorrect assumption

> "The schema has `enum` and `maxlength`, so an update cannot violate them."

### Actual behaviour

Validators run on `save()` and `create()`. Update operations bypass them unless `runValidators: true`. An update can write a value the schema forbids.

Even then, update validators have less context than document validators — `this` is the query, not the document, so custom validators depending on sibling fields behave differently.

### Correct pattern

`runValidators: true` on every update that writes user-influenced data. Treat the schema as the last line, never the first — request validators (zod) come first.

### Unsafe

```ts
return Lead.findOneAndUpdate({ _id: id }, { $set: patch }, { new: true });
```

### Safe

```ts
return Lead.findOneAndUpdate(
  { _id: id, isDeleted: false },
  { $set: patch },
  { new: true, runValidators: true }
);
```

---

## §7 — `findOneAndUpdate` returns the *pre-update* document

### Description

Without `new: true`, the returned document is the state **before** the update.

### Incorrect assumption

> "I updated the status, so the returned document has the new status."

### Actual behaviour

Default is `new: false`. Returning it to a client reports the old value as though it were current — the UI shows the change failing while the database shows it succeeding.

### Correct pattern

`{ new: true }` on every `findOneAndUpdate` whose result is returned or inspected. Where the *previous* value is genuinely needed (diffing for audit logs), fetch it first and keep the two reads explicit.

### Unsafe

```ts
const lead = await Lead.findOneAndUpdate({ _id: id }, { $set: { status } });
return lead;   // still shows the old status
```

### Safe

```ts
const before = await leadRepository.findById(id);          // for the audit diff
const after = await Lead.findOneAndUpdate(
  { _id: id }, { $set: { status } }, { new: true, runValidators: true }
);
```

---

## §8 — Counters must use `$inc`, never read-modify-write

### Description

Read a number, add one, save it.

### Incorrect assumption

> "Two concurrent updates will not collide."

### Actual behaviour

They will, and the lost update is silent. For `Media.usageCount` a lost decrement leaves an asset permanently undeletable; a lost increment allows deleting an asset that is still referenced, leaving broken images on the live site.

Lead numbers are worse: `countDocuments() + 1` produces duplicate numbers under concurrent submissions, and the unique index turns that into a **failed lead capture** — a lost customer.

### Correct pattern

`$inc` for counters. An atomic `findOneAndUpdate` on a dedicated counter document for sequences. Plus a reconciliation script for anything derived — `npm run reconcile:media`.

### Unsafe

```ts
const media = await Media.findById(id);
media.usageCount += 1;
await media.save();                                  // lost update

const seq = (await Lead.countDocuments()) + 1;       // duplicate lead numbers
```

### Safe

```ts
await Media.updateOne({ _id: id }, { $inc: { usageCount: by } });

const doc = await Counter.findByIdAndUpdate(
  key, { $inc: { seq: 1 } }, { new: true, upsert: true }
);
```

---

## §9 — `Document<string>` for non-ObjectId `_id`

### Description

The `Counter` model is keyed by name (`"lead-2026"`), not an ObjectId.

### Actual behaviour

`interface ICounter extends Document` defaults `_id` to `ObjectId`, and declaring `_id: string` is a TypeScript error (TS2430) — a compile-time failure rather than a runtime one, but it sends people toward an `as unknown as` cast that hides the mismatch.

### Correct pattern

```ts
export interface ICounter extends Document<string> {
  _id: string;
  seq: number;
}
```

---

## §10 — `.lean()` returns plain objects

### Description

`.lean()` skips document hydration for speed.

### Actual behaviour

The result has no virtuals, no getters, no `toJSON` transform, and no instance methods. **`toJSON` transforms are how `passwordHash` and `__v` are stripped from `User`** — a `.lean()` read of a user bypasses that protection entirely.

`_id` is an `ObjectId`, not a string, so `lean._id === someString` is always false. Comparisons need `String(doc._id)`.

### Correct pattern

`.lean()` freely for list projections that are shaped explicitly. **Never `.lean()` on a query whose `toJSON` transform is doing security work**, unless the fields are explicitly projected.

### Unsafe

```ts
const users = await User.find().lean();   // toJSON transform skipped
res.json({ data: users });                // passwordHash may be present if selected
```

### Safe

```ts
const users = await User.find();                          // transform applies
const rows = await Lead.find(filter).select("name email").lean<Lead[]>();
```

---

## §11 — Aggregation bypasses casting entirely

### Description

`$match` inside `aggregate()` looks like a `find` filter.

### Actual behaviour

It is not one. Aggregation pipelines are passed to MongoDB **uncast**: no schema types applied, no `sanitizeFilter`, no operator wrapping.

Two consequences, in opposite directions:

1. Raw operators work — which is why the dashboard's `$gte` date filters never hit §1.
2. **Nothing sanitises them.** A user-supplied value interpolated into a `$match` is an injection point with no framework protection whatsoever.

A `_id` string must be converted to `ObjectId` manually; aggregation will not do it and the pipeline silently matches nothing.

### Correct pattern

Treat every aggregation `$match` as raw MongoDB. Never interpolate a request value without validating it first. Convert ids explicitly.

### Unsafe

```ts
Lead.aggregate([{ $match: { status: req.query.status } }]);   // unvalidated, unsanitised
Lead.aggregate([{ $match: { productId: req.params.id } }]);   // string !== ObjectId, matches nothing
```

### Safe

```ts
const { status } = leadListQuerySchema.parse(req.query);       // enum-validated
Lead.aggregate([
  { $match: { status, productId: new mongoose.Types.ObjectId(id) } },
]);
```

---

## §12 — Detection standard

Three of the incidents above returned a plausible response while doing nothing:

- §1 Incident A returned an error to the caller and left the token chain alive.
- §3 would have accepted every write while enforcing no constraint.
- §8 loses updates without any error at all.

**A test that asserts "the endpoint returned an error" would have passed all three.**

The standard for anything touching tokens, sessions, counters or uniqueness:

| Instead of asserting | Assert |
|---|---|
| Reuse returns 401 | Reuse returns 401 **and the successor token is now dead** |
| Delete returns 409 | Delete returns 409 **and the count matches actual references** |
| Duplicate returns 409 | Duplicate returns 409 **and the index exists in this environment** |
| Update returns 200 | Update returns 200 **and a re-read shows the new value** |

These belong in `TESTING_STRATEGY.md` when it is written. Until then they are manual, and this section is the checklist.

---

## Audit command

The grep that found §1 Incident C. Run it after any repository change:

```bash
grep -rnE '\$(gt|gte|lt|lte|ne|in|nin|exists|regex|all|size)\b' server/src/repositories server/src/services --include=*.ts \
  | grep -v 'trusted(' \
  | grep -vE '\$set|\$inc|\$unset|\$push|\$pull|\$match|\$group'
```

Every hit must be either inside `countDocuments`, inside an aggregation, or wrapped in `mongoose.trusted()`. Anything else is a latent 500.
