import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISettings extends Document {
  key: string;
  company: { legalName: string; brandName: string; tagline: string; about: string };
  contact: {
    phone: string;
    altPhone?: string;
    whatsapp?: string;
    email: string;
    salesEmail?: string;
    website?: string;
  };
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  social: {
    facebook?: string | null;
    linkedin?: string | null;
    instagram?: string | null;
    youtube?: string | null;
  };
  analytics: { gaMeasurementId?: string; gtmContainerId?: string };
  features: { blogEnabled: boolean; dealerNetworkEnabled: boolean; whatsappWidgetEnabled: boolean };
  maintenanceMode: boolean;
  updatedAt: Date;
}

/**
 * Singleton — always key "global". Replaces the values currently hardcoded in
 * Footer.jsx and Contact.jsx. Placeholder values are carried forward as-is
 * rather than invented; see docs/SEED_DATA.md §2.
 */
const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    company: {
      legalName: { type: String, default: "" },
      brandName: { type: String, default: "" },
      tagline: { type: String, default: "" },
      about: { type: String, default: "" },
    },
    contact: {
      phone: { type: String, default: "" },
      altPhone: { type: String },
      whatsapp: { type: String },
      email: { type: String, default: "" },
      salesEmail: { type: String },
      website: { type: String },
    },
    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      pincode: { type: String },
      country: { type: String, default: "India" },
      // Left null deliberately. A 0,0 coordinate is a real location in the
      // Atlantic, and LocalBusiness schema emitting it is worse than omitting
      // the property. docs/SEED_DATA.md §2
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    social: {
      facebook: { type: String, default: null },
      linkedin: { type: String, default: null },
      instagram: { type: String, default: null },
      youtube: { type: String, default: null },
    },
    analytics: {
      gaMeasurementId: { type: String },
      gtmContainerId: { type: String },
    },
    features: {
      blogEnabled: { type: Boolean, default: false },
      dealerNetworkEnabled: { type: Boolean, default: false },
      whatsappWidgetEnabled: { type: Boolean, default: false },
    },
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Settings: Model<ISettings> = mongoose.model<ISettings>(
  "Settings",
  settingsSchema
);
export default Settings;
