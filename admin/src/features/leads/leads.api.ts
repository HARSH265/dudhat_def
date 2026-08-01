import { api, qs } from "@/lib/api";
import type { LeadStatus, Role } from "@/types/api";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "quotation_sent",
  "won",
  "lost",
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  quotation_sent: "Quotation sent",
  won: "Won",
  lost: "Lost",
};

/**
 * Mirrors STATUS_TRANSITIONS on the server. Used to disable impossible
 * options in the UI — the server still enforces it, and when the two
 * disagree the server is right.
 */
export const STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "qualified", "lost"],
  contacted: ["qualified", "quotation_sent", "lost"],
  qualified: ["quotation_sent", "won", "lost"],
  quotation_sent: ["won", "lost"],
  won: [],
  lost: [],
};

export interface AssignedUser {
  _id: string;
  name: string;
  email: string;
}

export interface Lead {
  _id: string;
  leadNumber: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  message: string;
  productName?: string;
  quantity?: string;
  city?: string;
  state?: string;
  country?: string;
  type: string;
  status: LeadStatus;
  lostReason?: string;
  priority: "low" | "medium" | "high";
  assignedTo?: AssignedUser | string | null;
  source: string;
  sourcePage?: string;
  utm?: Record<string, string>;
  isSpam: boolean;
  spamScore: number;
  estimatedValue?: number;
  firstContactedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  _id: string;
  leadId: string;
  userId?: { _id: string; name: string; email: string } | null;
  type: string;
  fromStatus?: LeadStatus;
  toStatus?: LeadStatus;
  note?: string;
  createdAt: string;
}

export interface LeadFilters {
  page?: number;
  limit?: number;
  sort?: string;
  status?: LeadStatus | "";
  type?: string;
  source?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
  isSpam?: "true" | "false" | "";
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export const leadsApi = {
  list: (filters: LeadFilters) =>
    api.getPaged<Lead>(`/admin/leads${qs({ ...filters })}`),

  get: (id: string) =>
    api.get<{ lead: Lead; activities: LeadActivity[] }>(`/admin/leads/${id}`),

  update: (
    id: string,
    patch: {
      status?: LeadStatus;
      lostReason?: string;
      priority?: string;
      estimatedValue?: number;
    }
  ) => api.patch<Lead>(`/admin/leads/${id}`, patch),

  addNote: (id: string, note: string) =>
    api.post(`/admin/leads/${id}/notes`, { note }),

  assign: (id: string, assignedTo: string | null) =>
    api.post<Lead>(`/admin/leads/${id}/assign`, { assignedTo }),

  markSpam: (id: string, isSpam: boolean) =>
    api.post<Lead>(`/admin/leads/${id}/spam`, { isSpam }),

  users: () => api.get<AdminUser[]>("/admin/auth/users"),
};

export function assignedName(lead: Lead): string | null {
  const assigned = lead.assignedTo;
  if (!assigned) return null;
  return typeof assigned === "string" ? assigned : assigned.name;
}
