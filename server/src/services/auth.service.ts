import type { Types } from "mongoose";
import { logger } from "../config/logger";
import { env } from "../config/env";
import type { IUser, Role } from "../models/User";
import { userRepository } from "../repositories/user.repository";
import { refreshTokenRepository } from "../repositories/refreshToken.repository";
import { auditService } from "./audit.service";
import { AppError, ErrorCode } from "../utils/AppError";
import {
  generateRefreshToken,
  hashPassword,
  sha256,
  verifyPassword,
} from "../utils/crypto";
import { signAccessToken } from "../utils/jwt";
import { checkPassword } from "../utils/passwordPolicy";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

export interface AuthContext {
  ipHash?: string;
  userAgent?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: { id: string; name: string; email: string; role: Role };
}

export const authService = {
  async login(
    email: string,
    password: string,
    ctx: AuthContext
  ): Promise<LoginResult> {
    const user = await userRepository.findByEmailWithPassword(email);

    // Identical message and comparable timing for unknown-email and
    // wrong-password. docs/SECURITY_ARCHITECTURE.md §3
    if (!user) {
      await verifyPassword(password, DUMMY_HASH);
      await auditService.record({
        action: "login_failed",
        entityType: "user",
        ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
        ...(ctx.userAgent ? { userAgent: ctx.userAgent } : {}),
      });
      throw AppError.unauthorized("Invalid email or password.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(
        401,
        "Too many attempts. Try again in 30 minutes.",
        ErrorCode.ACCOUNT_LOCKED
      );
    }

    if (!user.isActive) {
      throw AppError.unauthorized("Invalid email or password.");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockUntil =
        attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCK_DURATION_MS)
          : undefined;
      await userRepository.recordFailedLogin(user._id, lockUntil);
      await auditService.record({
        userId: user._id,
        action: "login_failed",
        entityType: "user",
        entityId: user._id,
        ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
      });
      throw AppError.unauthorized("Invalid email or password.");
    }

    await userRepository.recordSuccessfulLogin(user._id);
    await auditService.record({
      userId: user._id,
      action: "login",
      entityType: "user",
      entityId: user._id,
      ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
    });

    return this.issueTokens(user, ctx);
  },

  async issueTokens(user: IUser, ctx: AuthContext): Promise<LoginResult> {
    const accessToken = signAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = new Date(
      Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000
    );

    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiresAt,
      ...(ctx.userAgent ? { userAgent: ctx.userAgent } : {}),
      ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
    });

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  },

  /**
   * Rotates the refresh token. Presenting an already-rotated token means it
   * was captured, so the whole chain is revoked.
   * docs/SECURITY_ARCHITECTURE.md §3
   */
  async refresh(token: string, ctx: AuthContext): Promise<LoginResult> {
    const tokenHash = sha256(token);
    const stored = await refreshTokenRepository.findByHash(tokenHash);

    if (!stored) {
      throw AppError.unauthorized("Invalid session.", ErrorCode.TOKEN_INVALID);
    }

    if (stored.revokedAt) {
      // Only a token that was legitimately ROTATED and is now being replayed
      // is evidence of theft. A token revoked administratively — password
      // change, logout, deactivation — is simply dead, and treating its next
      // use as an attack would revoke the whole chain, including the session
      // a password change deliberately preserved.
      const isReplay =
        stored.revokedReason === undefined || stored.revokedReason === "rotated";

      if (!isReplay) {
        throw AppError.unauthorized("Session expired.", ErrorCode.TOKEN_EXPIRED);
      }

      const revoked = await refreshTokenRepository.revokeAllForUser(
        stored.userId,
        "reuse_detected"
      );
      logger.error(
        { userId: stored.userId.toString(), revoked },
        "Refresh token reuse detected — all sessions revoked"
      );
      await auditService.record({
        userId: stored.userId,
        action: "token_reuse_detected",
        entityType: "user",
        entityId: stored.userId,
        ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
      });
      throw AppError.unauthorized("Session revoked.", ErrorCode.TOKEN_INVALID);
    }

    if (stored.expiresAt < new Date()) {
      throw AppError.unauthorized("Session expired.", ErrorCode.TOKEN_EXPIRED);
    }

    const user = await userRepository.findById(stored.userId);
    if (!user || !user.isActive) {
      throw AppError.unauthorized("Session invalid.", ErrorCode.TOKEN_INVALID);
    }

    const result = await this.issueTokens(user, ctx);
    await refreshTokenRepository.revoke(
      tokenHash,
      "rotated",
      sha256(result.refreshToken)
    );
    return result;
  },

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await refreshTokenRepository.revoke(sha256(token), "logout");
  },

  async logoutAll(userId: Types.ObjectId): Promise<number> {
    return refreshTokenRepository.revokeAllForUser(userId, "logout");
  },

  /**
   * Phase 1 review M5: the guard was documented in
   * docs/ADMIN_PANEL_SPECIFICATION.md §5.13 and a helper existed for it, but
   * nothing called it. Locking every superadmin out of the panel is
   * unrecoverable without database access.
   */
  async setUserStatus(
    targetId: string,
    isActive: boolean,
    actor: { userId: Types.ObjectId }
  ): Promise<IUser> {
    const target = await userRepository.findById(targetId);
    if (!target) throw AppError.notFound("User not found.");

    if (!isActive && target.role === "superadmin") {
      const remaining = await userRepository.countActiveSuperadmins();
      if (remaining <= 1) {
        throw AppError.conflict(
          "This is the last active superadmin and cannot be deactivated.",
          ErrorCode.RESOURCE_IN_USE
        );
      }
    }

    if (target._id.equals(actor.userId) && !isActive) {
      throw AppError.badRequest("You cannot deactivate your own account.");
    }

    const updated = await userRepository.setActive(target._id, isActive);
    if (!updated) throw AppError.notFound("User not found.");

    // Deactivation must take effect immediately, not when the access token
    // happens to expire.
    if (!isActive) {
      await refreshTokenRepository.revokeAllForUser(target._id, "admin_action");
    }

    await auditService.record({
      userId: actor.userId,
      action: "update",
      entityType: "user",
      entityId: target._id,
      changes: { isActive: { from: target.isActive, to: isActive } },
    });

    return updated;
  },

  async setUserRole(
    targetId: string,
    role: Role,
    actor: { userId: Types.ObjectId }
  ): Promise<IUser> {
    const target = await userRepository.findById(targetId);
    if (!target) throw AppError.notFound("User not found.");

    if (target._id.equals(actor.userId)) {
      throw AppError.badRequest("You cannot change your own role.");
    }

    if (target.role === "superadmin" && role !== "superadmin") {
      const remaining = await userRepository.countActiveSuperadmins();
      if (remaining <= 1) {
        throw AppError.conflict(
          "This is the last active superadmin and cannot be demoted.",
          ErrorCode.RESOURCE_IN_USE
        );
      }
    }

    const updated = await userRepository.setRole(target._id, role);
    if (!updated) throw AppError.notFound("User not found.");

    // A role change alters permissions; existing sessions must not outlive it.
    await refreshTokenRepository.revokeAllForUser(target._id, "admin_action");

    await auditService.record({
      userId: actor.userId,
      action: "update",
      entityType: "user",
      entityId: target._id,
      changes: { role: { from: target.role, to: role } },
    });

    return updated;
  },

  async listUsers(): Promise<IUser[]> {
    return userRepository.listAll();
  },

  /**
   * Change own password. docs/SECURITY_TODO.md S4
   *
   * SESSION INVALIDATION STRATEGY — the deliberate part:
   *
   * A password change must end every OTHER session (the point of changing it
   * is usually that one may be compromised) without logging the user out of
   * the device they are sitting at, which would make the safe action feel
   * like a punishment and discourage it.
   *
   * So:
   *   1. `passwordChangedAt` is stamped, which invalidates every previously
   *      issued ACCESS token — `authenticate` compares it against `iat`.
   *   2. Every refresh token except the caller's is revoked.
   *   3. The caller's refresh token is rotated and a fresh access token
   *      issued, so the current device continues seamlessly.
   *
   * Net effect: other devices are logged out within their access-token TTL
   * (15 minutes at most, immediately on their next refresh), and the current
   * device never notices.
   */
  async changePassword(
    userId: Types.ObjectId,
    currentPassword: string,
    newPassword: string,
    currentRefreshToken: string | undefined,
    ctx: AuthContext
  ): Promise<LoginResult> {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) throw AppError.unauthorized("Session invalid.");

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      await auditService.record({
        userId: user._id,
        action: "login_failed",
        entityType: "user",
        entityId: user._id,
        changes: { reason: "change_password_wrong_current" },
        ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
      });
      throw AppError.badRequest("Your current password is incorrect.", [
        { field: "currentPassword", message: "Incorrect password." },
      ]);
    }

    if (currentPassword === newPassword) {
      throw AppError.badRequest("The new password must be different.", [
        { field: "newPassword", message: "Must differ from the current password." },
      ]);
    }

    const failures = checkPassword(newPassword, {
      email: user.email,
      name: user.name,
    });
    if (failures.length > 0) {
      throw AppError.badRequest(
        failures[0]?.message ?? "Password does not meet the policy.",
        failures
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.setPassword(user._id, passwordHash);

    // Revoke others, then rotate this one. Order matters: revoking all and
    // then issuing would briefly leave the caller with no valid session.
    const keepHash = currentRefreshToken ? sha256(currentRefreshToken) : "";
    const revoked = keepHash
      ? await refreshTokenRepository.revokeAllForUserExcept(
          user._id,
          keepHash,
          "password_change"
        )
      : await refreshTokenRepository.revokeAllForUser(user._id, "password_change");

    if (keepHash) await refreshTokenRepository.revoke(keepHash, "password_change");

    await auditService.record({
      userId: user._id,
      action: "update",
      entityType: "user",
      entityId: user._id,
      // Never the password, never the hash. Only that it happened.
      changes: { passwordChanged: true, otherSessionsRevoked: revoked },
      ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
    });

    logger.info(
      { userId: user._id.toString(), revoked },
      "Password changed; other sessions revoked"
    );

    const refreshed = await userRepository.findById(user._id);
    return this.issueTokens(refreshed ?? user, ctx);
  },

  async listSessions(
    userId: Types.ObjectId,
    currentRefreshToken: string | undefined
  ): Promise<
    {
      id: string;
      userAgent: string | null;
      createdAt: Date;
      expiresAt: Date;
      isCurrent: boolean;
    }[]
  > {
    const currentHash = currentRefreshToken ? sha256(currentRefreshToken) : null;
    const sessions = await refreshTokenRepository.listActiveForUser(userId);

    return sessions.map((s) => ({
      id: String(s._id),
      userAgent: s.userAgent ?? null,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: currentHash !== null && s.tokenHash === currentHash,
      // ipHash is deliberately NOT returned. It is a salted hash with no
      // value to the user, and exposing it only widens what a stolen
      // response reveals. docs/SECURITY_ARCHITECTURE.md §8
    }));
  },

  async revokeSession(
    userId: Types.ObjectId,
    sessionId: string,
    currentRefreshToken: string | undefined,
    ctx: AuthContext
  ): Promise<void> {
    const session = await refreshTokenRepository.findActiveByIdForUser(
      sessionId,
      userId
    );
    if (!session) throw AppError.notFound("Session not found.");

    // Revoking your own current session is just a logout, and doing it here
    // would leave the client holding a dead cookie it thinks is live.
    const currentHash = currentRefreshToken ? sha256(currentRefreshToken) : null;
    if (currentHash && session.tokenHash === currentHash) {
      throw AppError.badRequest(
        "That is your current session. Use sign out instead."
      );
    }

    await refreshTokenRepository.revokeById(sessionId, "logout");

    await auditService.record({
      userId,
      action: "logout",
      entityType: "user",
      entityId: userId,
      changes: { revokedSession: sessionId },
      ...(ctx.ipHash ? { ipHash: ctx.ipHash } : {}),
    });
  },

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }): Promise<IUser> {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw AppError.conflict(
        "A user with that email already exists.",
        ErrorCode.DUPLICATE_EMAIL
      );
    }
    const passwordHash = await hashPassword(data.password);
    return userRepository.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
    });
  },
};

/**
 * Compared against when the email is unknown, so a missing account costs the
 * same time as a wrong password. Without this, response timing reveals which
 * emails are registered.
 */
const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.Gm7YQ9QhVYQ0j3xO4nJ0lHqYd6r7wKq";
