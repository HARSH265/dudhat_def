import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "publish",
  "unpublish",
  "login",
  "logout",
  "login_failed",
  "token_reuse_detected",
  "export",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface IActivityLog extends Document {
  userId?: Types.ObjectId;
  action: AuditAction;
  entityType: string;
  entityId?: Types.ObjectId;
  changes?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    // Diff only, built from a per-entity allowlist. Never full documents,
    // never a select:false field. docs/SECURITY_ARCHITECTURE.md §11
    changes: { type: Schema.Types.Mixed },
    ipHash: { type: String },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
// 365-day retention, enforced by MongoDB rather than a cron job.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const ActivityLog: Model<IActivityLog> = mongoose.model<IActivityLog>(
  "ActivityLog",
  activityLogSchema
);
export default ActivityLog;
