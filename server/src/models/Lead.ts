import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "quotation_sent",
  "won",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TYPES = ["contact", "quote", "callback", "whatsapp", "brochure"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_SOURCES = ["website", "phone", "email", "whatsapp", "referral", "import"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/**
 * Allowed status transitions. Any status may jump to `lost`; `won` and `lost`
 * are terminal. docs/DATABASE_ARCHITECTURE.md §5.7
 */
export const STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "qualified", "lost"],
  contacted: ["qualified", "quotation_sent", "lost"],
  qualified: ["quotation_sent", "won", "lost"],
  quotation_sent: ["won", "lost"],
  won: [],
  lost: [],
};

export interface ILead extends Document {
  _id: Types.ObjectId;
  leadNumber: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  message: string;
  productId?: Types.ObjectId;
  productName?: string;
  quantity?: string;
  city?: string;
  state?: string;
  country: string;
  type: LeadType;
  status: LeadStatus;
  lostReason?: string;
  priority: "low" | "medium" | "high";
  assignedTo?: Types.ObjectId;
  source: LeadSource;
  sourcePage?: string;
  utm?: Record<string, string>;
  referrer?: string;
  ipHash?: string;
  userAgent?: string;
  isSpam: boolean;
  spamScore: number;
  firstContactedAt?: Date;
  closedAt?: Date;
  estimatedValue?: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    leadNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true },
    company: { type: String, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },

    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, trim: true },
    quantity: { type: String, trim: true, maxlength: 100 },

    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, default: "India" },

    type: { type: String, enum: LEAD_TYPES, default: "contact" },
    status: { type: String, enum: LEAD_STATUSES, default: "new" },
    lostReason: { type: String, trim: true, maxlength: 500 },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },

    source: { type: String, enum: LEAD_SOURCES, default: "website" },
    sourcePage: { type: String, trim: true, maxlength: 200 },
    utm: { type: Schema.Types.Mixed },
    referrer: { type: String, trim: true, maxlength: 500 },

    // Salted hash. The raw IP is used in-request for rate limiting and then
    // discarded. docs/SECURITY_ARCHITECTURE.md §8
    ipHash: { type: String },
    userAgent: { type: String, maxlength: 300 },

    isSpam: { type: Boolean, default: false },
    spamScore: { type: Number, default: 0, min: 0, max: 100 },

    firstContactedAt: { type: Date },
    closedAt: { type: Date },
    estimatedValue: { type: Number, min: 0 },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ email: 1, createdAt: -1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ productId: 1, createdAt: -1 });
leadSchema.index({ isSpam: 1, createdAt: -1 });
leadSchema.index({ isDeleted: 1 });
leadSchema.index({ name: "text", company: "text", email: "text", message: "text" });

export const Lead: Model<ILead> = mongoose.model<ILead>("Lead", leadSchema);
export default Lead;
