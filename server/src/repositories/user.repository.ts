import type { Types } from "mongoose";
import User, { type IUser, type Role } from "../models/User";

export const userRepository = {
  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() });
  },

  /** Includes passwordHash, which is select:false by default. */
  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  },

  async findById(id: string | Types.ObjectId): Promise<IUser | null> {
    return User.findById(id);
  },

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
  }): Promise<IUser> {
    return User.create(data);
  },

  async recordSuccessfulLogin(id: Types.ObjectId): Promise<void> {
    await User.updateOne(
      { _id: id },
      { $set: { lastLoginAt: new Date(), failedLoginAttempts: 0 }, $unset: { lockedUntil: 1 } }
    );
  },

  async recordFailedLogin(id: Types.ObjectId, lockUntil?: Date): Promise<void> {
    const update: Record<string, unknown> = { $inc: { failedLoginAttempts: 1 } };
    if (lockUntil) update["$set"] = { lockedUntil: lockUntil };
    await User.updateOne({ _id: id }, update);
  },

  async countActiveSuperadmins(): Promise<number> {
    return User.countDocuments({ role: "superadmin", isActive: true });
  },
};
