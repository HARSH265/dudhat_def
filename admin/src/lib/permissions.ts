import type { Role } from "@/types/api";

/**
 * Mirrors docs/ADMIN_PANEL_SPECIFICATION.md §4.
 *
 * FOR UI PURPOSES ONLY. This hides navigation and actions the role cannot
 * use. It is not a security control — every endpoint is authorised
 * server-side regardless, and when the two disagree the server is right and
 * this file is the bug. docs/SECURITY_TODO.md S12
 */
export type Capability =
  | "leads.read"
  | "leads.write"
  | "leads.assign"
  | "leads.export"
  | "leads.delete"
  | "catalogue.read"
  | "catalogue.write"
  | "catalogue.publish"
  | "catalogue.delete"
  | "media.read"
  | "media.write"
  | "media.delete"
  | "settings.read"
  | "settings.write"
  | "users.read"
  | "users.write"
  | "audit.read";

const MATRIX: Record<Role, Capability[]> = {
  superadmin: [
    "leads.read", "leads.write", "leads.assign", "leads.export", "leads.delete",
    "catalogue.read", "catalogue.write", "catalogue.publish", "catalogue.delete",
    "media.read", "media.write", "media.delete",
    "settings.read", "settings.write",
    "users.read", "users.write",
    "audit.read",
  ],
  admin: [
    "leads.read", "leads.write", "leads.assign", "leads.export",
    "catalogue.read", "catalogue.write", "catalogue.publish", "catalogue.delete",
    "media.read", "media.write", "media.delete",
    "settings.read", "settings.write",
    "users.read",
    "audit.read",
  ],
  // No lead access at all: content contributors have no reason to hold
  // customer contact data, and narrowing that surface is the cheapest
  // privacy control available.
  editor: [
    "catalogue.read", "catalogue.write", "catalogue.publish",
    "media.read", "media.write",
    "settings.read",
  ],
  // Leads only. A sales user editing the live product page is a category
  // error, so the separation runs both ways.
  sales: ["leads.read", "leads.write"],
};

export function can(role: Role | undefined, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[role].includes(capability);
}

export function canAny(role: Role | undefined, capabilities: Capability[]): boolean {
  return capabilities.some((c) => can(role, c));
}
