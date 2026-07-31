import Contact, { type IContact } from "../models/Contact";

export interface CreateContactData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  message: string;
}

/**
 * Database operations only. No business conditions, no validation, no
 * request awareness. docs/ARCHITECTURE.md
 */
export const contactRepository = {
  async create(data: CreateContactData): Promise<IContact> {
    return Contact.create(data);
  },

  async countByEmailSince(email: string, since: Date): Promise<number> {
    return Contact.countDocuments({ email, createdAt: { $gte: since } });
  },
};
