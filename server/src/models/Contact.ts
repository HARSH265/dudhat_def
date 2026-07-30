import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IContact extends Document {
  name: string;
  email: string;
  phone: string;
  company?: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt aur updatedAt automatically add ho jayenge
  }
);

// Superseded by `leads` in Phase 1D. Kept read-compatible for the migration.
// docs/DATABASE_ARCHITECTURE.md §8 (M1)
export const Contact: Model<IContact> = mongoose.model<IContact>(
  "Contact",
  contactSchema
);

export default Contact;
