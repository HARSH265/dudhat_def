import mongoose, { type Types } from "mongoose";
import { leadRepository, type Paged } from "../repositories/lead.repository";
import { userRepository } from "../repositories/user.repository";
import { auditService } from "./audit.service";
import { AppError, ErrorCode } from "../utils/AppError";
import { normalisePhone } from "../utils/phone";
import {
  STATUS_TRANSITIONS,
  type ILead,
  type LeadStatus,
} from "../models/Lead";
import type { ILeadActivity } from "../models/LeadActivity";
import type {
  CreateLeadInput,
  LeadListQuery,
  UpdateLeadInput,
} from "../validators/lead.validator";

export interface ActorContext {
  userId: Types.ObjectId;
  ipHash?: string;
}

export const leadAdminService = {
  async list(q: LeadListQuery): Promise<Paged<ILead>> {
    return leadRepository.list(q);
  },

  async getWithTimeline(
    id: string
  ): Promise<{ lead: ILead; activities: ILeadActivity[] }> {
    const lead = await leadRepository.findById(id);
    if (!lead) throw AppError.notFound("Lead not found.");
    const activities = await leadRepository.listActivities(id);
    return { lead, activities };
  },

  /**
   * Phase 1 review M4: STATUS_TRANSITIONS existed but nothing consulted it.
   * This is the enforcement point. docs/DATABASE_ARCHITECTURE.md §5.7
   */
  async update(
    id: string,
    patch: UpdateLeadInput,
    actor: ActorContext
  ): Promise<ILead> {
    const lead = await leadRepository.findById(id);
    if (!lead) throw AppError.notFound("Lead not found.");

    const changes: Partial<ILead> = {};
    let statusChanged: { from: LeadStatus; to: LeadStatus } | null = null;

    if (patch.status && patch.status !== lead.status) {
      const allowed = STATUS_TRANSITIONS[lead.status];
      if (!allowed.includes(patch.status)) {
        throw AppError.conflict(
          allowed.length === 0
            ? `A lead marked "${lead.status}" is closed and cannot change status.`
            : `Cannot move a lead from "${lead.status}" to "${patch.status}". Allowed: ${allowed.join(", ")}.`,
          ErrorCode.INVALID_STATUS_TRANSITION
        );
      }

      if (patch.status === "lost" && !patch.lostReason?.trim()) {
        throw AppError.badRequest("A reason is required when marking a lead lost.", [
          { field: "lostReason", message: "Required when status is lost." },
        ]);
      }

      statusChanged = { from: lead.status, to: patch.status };
      changes.status = patch.status;

      if (patch.status === "lost") changes.lostReason = patch.lostReason;
      // First movement out of `new` is the response-time marker.
      if (!lead.firstContactedAt && patch.status !== "new") {
        changes.firstContactedAt = new Date();
      }
      if (patch.status === "won" || patch.status === "lost") {
        changes.closedAt = new Date();
      }
    }

    if (patch.priority) changes.priority = patch.priority;
    if (patch.estimatedValue !== undefined) {
      changes.estimatedValue = patch.estimatedValue;
    }

    const updated = await leadRepository.update(id, changes);
    if (!updated) throw AppError.notFound("Lead not found.");

    if (statusChanged) {
      await leadRepository.addActivity({
        leadId: updated._id,
        type: "status_changed",
        userId: actor.userId,
        fromStatus: statusChanged.from,
        toStatus: statusChanged.to,
        ...(patch.lostReason ? { note: patch.lostReason } : {}),
      });
    }

    await auditService.record({
      userId: actor.userId,
      action: "update",
      entityType: "lead",
      entityId: updated._id,
      changes: diffOf(lead, changes),
      ...(actor.ipHash ? { ipHash: actor.ipHash } : {}),
    });

    return updated;
  },

  async addNote(id: string, note: string, actor: ActorContext): Promise<void> {
    const lead = await leadRepository.findById(id);
    if (!lead) throw AppError.notFound("Lead not found.");

    await leadRepository.addActivity({
      leadId: lead._id,
      type: "note",
      userId: actor.userId,
      note,
    });
  },

  async assign(
    id: string,
    assigneeId: string | null,
    actor: ActorContext
  ): Promise<ILead> {
    const lead = await leadRepository.findById(id);
    if (!lead) throw AppError.notFound("Lead not found.");

    if (assigneeId) {
      const assignee = await userRepository.findById(assigneeId);
      if (!assignee || !assignee.isActive) {
        throw AppError.badRequest("That user cannot be assigned leads.");
      }
      // Content-only roles have no reason to hold customer contact data.
      // docs/ADMIN_PANEL_SPECIFICATION.md §4
      if (assignee.role === "editor") {
        throw AppError.badRequest("Editors do not have access to leads.");
      }
    }

    const updated = await leadRepository.update(id, {
      assignedTo: assigneeId
        ? new mongoose.Types.ObjectId(assigneeId)
        : (undefined as unknown as Types.ObjectId),
    });
    if (!updated) throw AppError.notFound("Lead not found.");

    await leadRepository.addActivity({
      leadId: updated._id,
      type: "assigned",
      userId: actor.userId,
      note: assigneeId ? `Assigned to ${assigneeId}` : "Assignment cleared",
    });

    return updated;
  },

  async markSpam(id: string, isSpam: boolean, actor: ActorContext): Promise<ILead> {
    const updated = await leadRepository.update(id, { isSpam });
    if (!updated) throw AppError.notFound("Lead not found.");

    await auditService.record({
      userId: actor.userId,
      action: "update",
      entityType: "lead",
      entityId: updated._id,
      changes: { isSpam: { to: isSpam } },
    });

    return updated;
  },

  async createManual(input: CreateLeadInput, actor: ActorContext): Promise<ILead> {
    const leadNumber = await leadRepository.generateLeadNumber();
    const lead = await leadRepository.create({
      leadNumber,
      ...input,
      phone: normalisePhone(input.phone),
      isSpam: false,
      spamScore: 0,
    });

    await leadRepository.addActivity({
      leadId: lead._id,
      type: "created",
      userId: actor.userId,
      note: "Created manually.",
    });

    await auditService.record({
      userId: actor.userId,
      action: "create",
      entityType: "lead",
      entityId: lead._id,
    });

    return lead;
  },

  async softDelete(id: string, actor: ActorContext): Promise<void> {
    const deleted = await leadRepository.softDelete(id, actor.userId);
    if (!deleted) throw AppError.notFound("Lead not found.");

    await auditService.record({
      userId: actor.userId,
      action: "delete",
      entityType: "lead",
      entityId: deleted._id,
      ...(actor.ipHash ? { ipHash: actor.ipHash } : {}),
    });
  },

  /**
   * The panel's largest data-egress action, so it is capped, audited with the
   * row count, and rate-limited at the route.
   * docs/SECURITY_ARCHITECTURE.md §8
   */
  async exportCsv(
    q: LeadListQuery,
    actor: ActorContext
  ): Promise<{ csv: string; rows: number }> {
    const EXPORT_CAP = 5000;
    const leads = await leadRepository.listForExport(q, EXPORT_CAP);

    const header = [
      "Lead Number", "Name", "Company", "Email", "Phone",
      "Type", "Status", "Priority", "Source", "City", "State",
      "Quantity", "Estimated Value", "Message", "Received",
    ];

    const rows = leads.map((l) => [
      l.leadNumber, l.name, l.company ?? "", l.email, l.phone,
      l.type, l.status, l.priority, l.source, l.city ?? "", l.state ?? "",
      l.quantity ?? "", l.estimatedValue?.toString() ?? "",
      l.message, l.createdAt.toISOString(),
    ]);

    await auditService.record({
      userId: actor.userId,
      action: "export",
      entityType: "lead",
      changes: { rows: leads.length, filters: JSON.parse(JSON.stringify(q)) },
      ...(actor.ipHash ? { ipHash: actor.ipHash } : {}),
    });

    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    return { csv, rows: leads.length };
  },
};

/**
 * A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
 * Prefixing with an apostrophe neutralises it without altering the value the
 * user sees. Lead messages are attacker-controlled, so this matters.
 */
function csvCell(value: string): string {
  const risky = /^[=+\-@\t\r]/.test(value);
  const safe = risky ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function diffOf(before: ILead, changes: Partial<ILead>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(changes)) {
    out[key] = {
      from: (before as unknown as Record<string, unknown>)[key],
      to: (changes as Record<string, unknown>)[key],
    };
  }
  return out;
}
