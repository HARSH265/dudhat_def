import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const ROLES = ["superadmin", "admin", "editor", "sales"] as const;
export type Role = (typeof ROLES)[number];

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // Never selected by default. A query must ask for it explicitly.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "editor", required: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    // Invalidates every access token issued before this moment.
    passwordChangedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret["passwordHash"];
        delete ret["__v"];
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1, isActive: 1 });

export const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;
