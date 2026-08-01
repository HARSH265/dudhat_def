# Phase 2E Security Review — S4, S5 and Session Invalidation

> **HISTORICAL.** Findings fixed and recorded. Kept for the record.
> Do not read for current state — see [PROJECT_STATUS.md](PROJECT_STATUS.md).

> Scope: the change-password endpoint, session listing and revocation, and the session-invalidation strategy behind them.
> Method: behavioural testing against a running server on the live Atlas connection. Every result below was reproduced.
> Closes [SECURITY_TODO.md](SECURITY_TODO.md) S4 (partly) and S5 (partly).

---

## 1. Why This Came Before Phase 2F

Until this change there was **no way for an admin to change their own password.** The only credential in existence was the one `seed:admin` printed once. Consequences: a suspected-compromised password could not be rotated without database access; a departing staff member's credential could only be neutralised by deactivating the account; and a one-time seed password inevitably ends up in a chat log because there is no path to replace it.

Expanding the product editor and media workflows on top of an unrotatable credential would have compounded that.

---

## 2. Session Invalidation Strategy

The design decision this phase turns on. Documented here and in [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §3.

### The requirement

A password change must end every **other** session — the usual reason for changing a password is that one of them may be compromised. It must **not** end the session doing the changing: making the safe action feel like a punishment is how you train people not to take it.

### The mechanism

1. `passwordChangedAt` is stamped in the same write as the new hash. `authenticate` compares it against each access token's `iat`, so **every previously issued access token stops working immediately** — including the caller's.
2. Every refresh token **except the caller's** is revoked, reason `password_change`.
3. The caller's refresh token is then rotated and a fresh access token issued, so the current device continues without interruption.

Net effect: other devices lose access within their access-token TTL — at most 15 minutes, immediately on their next refresh — and the current device never notices.

Ordering matters. Revoking everything and then issuing would leave the caller with no valid session for the duration of the write.

### Verified

| Check | Result |
|---|---|
| Device A changes password → `/me` with the returned token | 200 |
| Device A refresh after the change | 200 |
| Device B access token after the change | 401 |
| Device B refresh after the change | 401 |
| Sessions list from device A afterwards | 1 active, correctly marked current |

---

## 3. Defect Found and Fixed During This Work

**The first implementation of the strategy above did not work, and the failure was silent.**

### What happened

After a password change, all four of the user's refresh tokens were revoked — including the one deliberately preserved. Device A was signed out despite the design saying it should not be.

### Cause

Reuse detection (built in Phase 1C) treats *any* revoked token being presented as evidence of theft and revokes the user's entire chain. That is correct for a token which was legitimately rotated and is now being replayed.

It is wrong for a token revoked **administratively**. After a password change signs other devices out, the first of those devices to attempt a refresh presented a revoked token — reuse detection fired, and the chain revocation took out the session the password change had just protected.

The code could not tell the two cases apart, because a revoked token carried no record of *why*.

### Fix

`RefreshToken.revokedReason` — an enum of `rotated`, `logout`, `password_change`, `admin_action`, `reuse_detected`. Every revocation path now records one.

Reuse detection fires **only** when the reason is `rotated` (or absent, for rows predating this change — the conservative default). Administrative revocations return a plain `TOKEN_EXPIRED` instead.

### Verified after the fix

| Check | Result |
|---|---|
| Administratively revoked token presented | 401 `TOKEN_EXPIRED`, chain intact |
| Genuinely rotated token replayed | 401 `TOKEN_INVALID`, **entire chain revoked** |
| Successor of a replayed token | Also dead |
| Reasons recorded | `{ password_change: 2, rotated: 2, reuse_detected: 2 }` |

The security control is intact; it is now merely accurate about what constitutes an attack.

**Worth noting for future work:** this is the second time a Phase 1C security control has failed silently in a way that only behavioural testing caught — the first was `revokeAllForUser` never running at all (Phase 1 review). Both would have passed any test that asserted "the endpoint returned an error". Testing the *consequence* rather than the response is what found them, and that is the standard the checks in [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §12 need to meet when they are automated.

---

## 4. Second Defect: Password Policy Was Nearly Useless

The first implementation checked the candidate password for **exact membership** in a set of common passwords.

`password123456` was accepted.

An exact-match set catches `password` and nothing else — it accepts `password123456`, `mypassword1`, `qwertyuiop99`, which is precisely what people choose when told to make it longer. The set was giving the appearance of a control while providing almost none.

**Fix:** substring matching against a list of common *stems*, applied to both the raw password and a separator-stripped copy, so `p-a-s-s-w-o-r-d-99` is caught too.

**Verified:**

| Candidate | Result |
|---|---|
| `shortpw` | Rejected — under 12 characters |
| `password123456` | Rejected — contains `password` |
| `p-a-s-s-w-o-r-d-99` | Rejected — stem with separators |
| `MyQwerty12345` | Rejected — stem, case-insensitive |
| `ramesh-secure-vault` (user is `ramesh@…`) | Rejected — contains email local part |
| `abcdefghijklmn` | Rejected — sequential |
| `aaaaaaaaaaaaaa` | Rejected — single repeated character |
| `quiet-harbour-lantern-42` | Accepted |

### Known narrowing

[SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §3 calls for the **top-10k** common-password list. What ships is ~35 stems plus heuristics.

Shipping 10k entries inline is a poor trade for a handful of admin accounts, and a hosted breach-check API would send a password prefix to a third party. The stem approach catches the overwhelming majority of what those lists contain, because most entries are variations on a small number of roots. Recorded as a deliberate narrowing rather than an oversight.

---

## 5. Third Defect: `sanitizeFilter` Broke a Query Again

`listActiveForUser` filtered on `expiresAt: { $gt: new Date() }` and failed with *"Invalid value for expiresAt"*.

This is the same trap that silently disabled reuse detection in Phase 1: `mongoose.set('sanitizeFilter', true)` wraps operator objects in `$eq`, which then fails to cast against a typed path.

**Fix:** `mongoose.trusted({ $gt: … })` — Mongoose's documented escape hatch for application-authored operators — applied here and to the `$ne` in `revokeAllForUserExcept`.

Phase 1 fixed its instance by rewriting the query to avoid the operator. This is the general fix, and the pattern to use from now on: **any operator in a repository filter needs `mongoose.trusted()`.**

---

## 6. Endpoints Added

| Method | Path | Notes |
|---|---|---|
| `PATCH` | `/admin/auth/change-password` | Throttled like login — it accepts the current password, so it is an oracle for guessing it |
| `GET` | `/admin/auth/sessions` | Active sessions, current one flagged |
| `DELETE` | `/admin/auth/sessions/:id` | Own sessions only |

**Design notes:**

- **`ipHash` is not returned** by the sessions endpoint. It is a salted hash with no meaning to the user, and returning it only widens what a stolen response reveals.
- **Session queries are scoped to the owner in the query itself**, not by a check after fetching. A session id is not a capability; the ownership filter is what makes it safe to expose ids at all. Verified: an unknown id returns 404 rather than leaking existence.
- **Revoking your own current session is refused** with a pointer to sign-out. Allowing it would leave the client holding a cookie it believes is live.
- **Audit records never contain the password or hash** — only that a change happened and how many sessions it revoked.

---

## 7. Still Open

| Item | Status |
|---|---|
| S4 — `forgot-password` / `reset-password` | **Not built.** Needs SMTP. Target Phase 3 |
| S4 — 2FA for `superadmin` | Unscheduled |
| S5 — admin UI for sessions and password change | **Endpoints exist, no screen yet.** The API is usable via curl; the profile screen is small and should ship with 2F |
| S5 — server-side idle timeout | Not built. A captured refresh token stays valid for its full 7 days regardless of idleness |
| S5 — re-authentication for sensitive actions | Not built |

**The most important remaining gap is that there is still no UI for this.** The endpoint exists and works, but until a profile screen ships, rotating the seeded password requires a manual API call. That is a real improvement over "impossible", and short of the goal.

---

## 8. Recommendation

The seeded superadmin password is now rotatable, which was the stated blocker for Phase 2F. Rotate it before continuing:

```
PATCH /api/v1/admin/auth/change-password
{ "currentPassword": "<seeded>", "newPassword": "<new>" }
```

Then build the profile screen alongside 2F so it stops being a curl-only operation.
