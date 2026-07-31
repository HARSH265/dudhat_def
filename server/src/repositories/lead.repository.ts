import type { Types } from "mongoose";
import Lead, { type ILead } from "../models/Lead";
import LeadActivity, { type ActivityType } from "../models/LeadActivity";
import { nextSequence } from "../models/Counter";

export interface CreateLeadData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  message: string;
  type?: ILead["type"];
  source?: ILead["source"];
  sourcePage?: string;
  utm?: Record<string, string>;
  ipHash?: string;
  userAgent?: string;
  isSpam?: boolean;
  spamScore?: number;
}

export const leadRepository = {
  /**
   * DEF-<year>-<5 digits>, from an atomic counter rather than a document
   * count. docs/DATABASE_ARCHITECTURE.md §5.7
   */
  async generateLeadNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const seq = await nextSequence(`lead-${year}`);
    return `DEF-${year}-${String(seq).padStart(5, "0")}`;
  },

  async create(data: CreateLeadData & { leadNumber: string }): Promise<ILead> {
    return Lead.create(data);
  },

  async countByEmailSince(email: string, since: Date): Promise<number> {
    return Lead.countDocuments({ email, createdAt: { $gte: since }, isDeleted: false });
  },

  async addActivity(data: {
    leadId: Types.ObjectId;
    type: ActivityType;
    userId?: Types.ObjectId;
    note?: string;
    fromStatus?: ILead["status"];
    toStatus?: ILead["status"];
  }): Promise<void> {
    await LeadActivity.create(data);
  },
};
