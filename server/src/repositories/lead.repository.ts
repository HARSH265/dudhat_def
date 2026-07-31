import mongoose, { type FilterQuery, type Types } from "mongoose";
import Lead, { type ILead } from "../models/Lead";
import LeadActivity, { type ActivityType, type ILeadActivity } from "../models/LeadActivity";
import { nextSequence } from "../models/Counter";
import type { LeadListQuery } from "../validators/lead.validator";

export interface CreateLeadData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  message: string;
  type?: ILead["type"];
  source?: ILead["source"];
  sourcePage?: string;
  quantity?: string;
  city?: string;
  state?: string;
  priority?: ILead["priority"];
  estimatedValue?: number;
  utm?: Record<string, string>;
  ipHash?: string;
  userAgent?: string;
  isSpam?: boolean;
  spamScore?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

/**
 * Database operations only. No business conditions, no validation, no
 * request awareness. docs/ARCHITECTURE.md
 */
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

  async findById(id: string): Promise<ILead | null> {
    return Lead.findOne({ _id: id, isDeleted: false });
  },

  async list(q: LeadListQuery): Promise<Paged<ILead>> {
    const filter = buildFilter(q);

    // Two round-trips rather than an aggregation with $facet: the count uses
    // the same indexes as the find, and the query planner handles them
    // better separately at this collection size.
    const [items, total] = await Promise.all([
      Lead.find(filter)
        .sort(q.sort)
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate("assignedTo", "name email")
        .lean<ILead[]>(),
      Lead.countDocuments(filter),
    ]);

    return { items, total };
  },

  /** Unpaginated, for CSV export. Caller is responsible for bounding it. */
  async listForExport(q: LeadListQuery, cap: number): Promise<ILead[]> {
    return Lead.find(buildFilter(q))
      .sort(q.sort)
      .limit(cap)
      .populate("assignedTo", "name email")
      .lean<ILead[]>();
  },

  async update(id: string, patch: Partial<ILead>): Promise<ILead | null> {
    return Lead.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: patch },
      { new: true, runValidators: true }
    );
  },

  async softDelete(id: string, deletedBy: Types.ObjectId): Promise<ILead | null> {
    // Leads are business records — never hard-deleted at any layer.
    // docs/DATABASE_ARCHITECTURE.md §5.7
    return Lead.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
      { new: true }
    );
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

  async listActivities(leadId: string): Promise<ILeadActivity[]> {
    return LeadActivity.find({ leadId })
      .sort({ createdAt: -1 })
      .populate("userId", "name email")
      .lean<ILeadActivity[]>();
  },

  // --- dashboard aggregates ---

  async countInRange(filter: FilterQuery<ILead>): Promise<number> {
    return Lead.countDocuments({ ...filter, isDeleted: false, isSpam: false });
  },

  async groupBy(
    field: "status" | "source" | "type",
    range: { from: Date; to: Date }
  ): Promise<Record<string, number>> {
    const rows = await Lead.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          isDeleted: false,
          isSpam: false,
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  },

  async countByDay(range: { from: Date; to: Date }): Promise<{ date: string; count: number }[]> {
    return Lead.aggregate<{ date: string; count: number }>([
      {
        $match: {
          isDeleted: false,
          isSpam: false,
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", count: 1 } },
    ]);
  },

  async recent(limit: number): Promise<ILead[]> {
    return Lead.find({ isDeleted: false, isSpam: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("leadNumber name company email status type createdAt")
      .lean<ILead[]>();
  },
};

function buildFilter(q: LeadListQuery): FilterQuery<ILead> {
  const filter: FilterQuery<ILead> = { isDeleted: false };

  if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  if (q.source) filter.source = q.source;
  if (q.priority) filter.priority = q.priority;
  if (q.assignedTo) filter.assignedTo = new mongoose.Types.ObjectId(q.assignedTo);
  if (q.productId) filter.productId = new mongoose.Types.ObjectId(q.productId);

  // Undefined means "hide spam" rather than "show everything" — the working
  // list should not be polluted by default.
  filter.isSpam = q.isSpam ?? false;

  if (q.from || q.to) {
    const range: Record<string, Date> = {};
    if (q.from) range["$gte"] = q.from;
    if (q.to) range["$lte"] = q.to;
    filter.createdAt = range;
  }

  if (q.search) filter.$text = { $search: q.search };

  return filter;
}
