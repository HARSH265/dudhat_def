/** Response shapes. Mirrors the server; when they disagree the server wins. */

export const ROLES = ["superadmin", "admin", "editor", "sales"] as const;
export type Role = (typeof ROLES)[number];

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastLoginAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "quotation_sent",
  "won",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface RecentLead {
  _id: string;
  leadNumber: string;
  name: string;
  company?: string;
  email: string;
  status: LeadStatus;
  type: string;
  createdAt: string;
}

export interface DashboardData {
  totalLeads: number;
  newLeads: number;
  quoteRequests: number;
  /** Null until `pageviews` lands with the catalogue — not zero, which would
   *  read as "no views" rather than "not measured yet". */
  productViews: number | null;
  trends: {
    leadsThisPeriod: number;
    leadsPreviousPeriod: number;
    /** Null when the previous period was zero; a percentage from zero is
     *  meaningless and "100%" would be misleading. */
    changePercent: number | null;
  };
  leadsByStatus: Partial<Record<LeadStatus, number>>;
  leadsBySource: Record<string, number>;
  leadsOverTime: { date: string; count: number }[];
  recentLeads: RecentLead[];
  range: { from: string; to: string };
}
