import mongoose, { type Types } from "mongoose";
import RefreshToken, {
  type IRefreshToken,
  type RevokeReason,
} from "../models/RefreshToken";

export const refreshTokenRepository = {
  async create(data: {
    userId: Types.ObjectId;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipHash?: string;
  }): Promise<IRefreshToken> {
    return RefreshToken.create(data);
  },

  async findByHash(tokenHash: string): Promise<IRefreshToken | null> {
    return RefreshToken.findOne({ tokenHash });
  },

  async revoke(
    tokenHash: string,
    reason: RevokeReason,
    replacedByTokenHash?: string
  ): Promise<void> {
    const set: Record<string, unknown> = {
      revokedAt: new Date(),
      revokedReason: reason,
    };
    if (replacedByTokenHash) set["replacedByTokenHash"] = replacedByTokenHash;
    await RefreshToken.updateOne({ tokenHash }, { $set: set });
  },

  /**
   * Active sessions for the profile screen. Newest first.
   *
   * `mongoose.trusted()` marks the operator as application-authored so
   * `sanitizeFilter` does not wrap it in `$eq` and then fail to cast the
   * operator object to a Date. Same trap that silently disabled refresh-token
   * reuse detection in Phase 1 (review H-series, fixed there with a null
   * comparison); this is the general fix.
   */
  async listActiveForUser(userId: Types.ObjectId): Promise<IRefreshToken[]> {
    return RefreshToken.find({
      userId,
      revokedAt: null,
      expiresAt: mongoose.trusted({ $gt: new Date() }),
    })
      .sort({ createdAt: -1 })
      .lean<IRefreshToken[]>();
  },

  async findActiveByIdForUser(
    id: string,
    userId: Types.ObjectId
  ): Promise<IRefreshToken | null> {
    // Scoped to the owner: a session id is not a capability, so the query
    // itself enforces that a user can only revoke their own.
    return RefreshToken.findOne({ _id: id, userId, revokedAt: null });
  },

  async revokeById(id: string, reason: RevokeReason): Promise<void> {
    await RefreshToken.updateOne(
      { _id: id },
      { $set: { revokedAt: new Date(), revokedReason: reason } }
    );
  },

  /** Everything except one — used when a password change keeps the current session. */
  async revokeAllForUserExcept(
    userId: Types.ObjectId,
    keepTokenHash: string,
    reason: RevokeReason
  ): Promise<number> {
    const result = await RefreshToken.updateMany(
      { userId, revokedAt: null, tokenHash: mongoose.trusted({ $ne: keepTokenHash }) },
      { $set: { revokedAt: new Date(), revokedReason: reason } }
    );
    return result.modifiedCount;
  },

  async revokeAllForUser(
    userId: Types.ObjectId,
    reason: RevokeReason
  ): Promise<number> {
    // `revokedAt: null` matches both null and missing, and unlike
    // `{ $exists: false }` it survives casting on a Date path — Mongoose
    // tries to cast the operator object itself to a Date and throws.
    // That failure silently disabled reuse-detection revocation.
    const result = await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } }
    );
    return result.modifiedCount;
  },
};
