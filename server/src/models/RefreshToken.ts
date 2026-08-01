import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/**
 * Why a token was revoked. This distinction is load-bearing, not bookkeeping.
 *
 * Reuse detection treats a revoked token being presented as evidence of
 * theft and revokes the user's entire chain. That is right for `rotated` —
 * a token that was legitimately replaced and is now being replayed. It is
 * WRONG for administrative revocation: after a password change signs other
 * devices out, the first of those devices to attempt a refresh would
 * otherwise trigger a chain revocation that also kills the session the
 * password change deliberately preserved.
 */
export const REVOKE_REASONS = [
  "rotated",
  "logout",
  "password_change",
  "admin_action",
  "reuse_detected",
] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** SHA-256 of the token. The token itself is never stored. */
  tokenHash: string;
  userAgent?: string;
  ipHash?: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: RevokeReason;
  replacedByTokenHash?: string;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, maxlength: 300 },
    ipHash: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, enum: REVOKE_REASONS },
    replacedByTokenHash: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });
// MongoDB reaps expired tokens on its own.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema
);
export default RefreshToken;
