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
      const revoked = await refreshTokenRepository.revokeAllForUser(stored.userId);
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
    await refreshTokenRepository.revoke(tokenHash, sha256(result.refreshToken));
    return result;
  },

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await refreshTokenRepository.revoke(sha256(token));
  },

  async logoutAll(userId: Types.ObjectId): Promise<number> {
    return refreshTokenRepository.revokeAllForUser(userId);
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
