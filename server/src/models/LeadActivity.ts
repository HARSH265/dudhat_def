import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { LeadStatus } from "./Lead";

export const ACTIVITY_TYPES = [
  "created",
  "status_changed",
  "assigned",
  "note",
  "email_sent",
  "call_logged",
  "quotation_sent",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ILeadActivity extends Document {
  leadId: Types.ObjectId;
  userId?: Types.ObjectId;
  type: ActivityType;
  fromStatus?: LeadStatus;
  toStatus?: LeadStatus;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Append-only. No update or delete path is exposed at any layer — this is the
 * audit record of a commercial conversation, and letting users rewrite it
 * destroys its value. docs/ADMIN_PANEL_SPECIFICATION.md §5.5
 */
const leadActivitySchema = new Schema<ILeadActivity>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    fromStatus: { type: String },
    toStatus: { type: String },
    note: { type: String, maxlength: 2000 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

leadActivitySchema.index({ leadId: 1, createdAt: -1 });
leadActivitySchema.index({ userId: 1, createdAt: -1 });

export const LeadActivity: Model<ILeadActivity> = mongoose.model<ILeadActivity>(
  "LeadActivity",
  leadActivitySchema
);
export default LeadActivity;
