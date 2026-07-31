import type { Types } from "mongoose";
import RefreshToken, { type IRefreshToken } from "../models/RefreshToken";

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

  async revoke(tokenHash: string, replacedByTokenHash?: string): Promise<void> {
    const set: Record<string, unknown> = { revokedAt: new Date() };
    if (replacedByTokenHash) set["replacedByTokenHash"] = replacedByTokenHash;
    await RefreshToken.updateOne({ tokenHash }, { $set: set });
  },

  async revokeAllForUser(userId: Types.ObjectId): Promise<number> {
    // `revokedAt: null` matches both null and missing, and unlike
    // `{ $exists: false }` it survives casting on a Date path — Mongoose
    // tries to cast the operator object itself to a Date and throws.
    // That failure silently disabled reuse-detection revocation.
    const result = await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    return result.modifiedCount;
  },
};
