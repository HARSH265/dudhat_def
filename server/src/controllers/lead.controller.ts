import mongoose from "mongoose";
import type { Request, Response } from "express";
import { leadAdminService, type ActorContext } from "../services/leadAdmin.service";
import { dashboardService } from "../services/dashboard.service";
import { query } from "../middleware/validate";
import { hashIp } from "../utils/crypto";
import type {
  CreateLeadInput,
  LeadListQuery,
  UpdateLeadInput,
} from "../validators/lead.validator";

function actor(req: Request): ActorContext {
  const ipHash = hashIp(req.ip);
  return {
    userId: new mongoose.Types.ObjectId(req.user!.id),
    ...(ipHash ? { ipHash } : {}),
  };
}

export async function listLeads(_req: Request, res: Response): Promise<void> {
  const q = query<LeadListQuery>(res);
  const { items, total } = await leadAdminService.list(q);
  const totalPages = Math.max(1, Math.ceil(total / q.limit));

  res.status(200).json({
    success: true,
    message: "Leads fetched.",
    data: items,
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasNext: q.page < totalPages,
      hasPrev: q.page > 1,
    },
  });
}

export async function getLead(req: Request, res: Response): Promise<void> {
  const { lead, activities } = await leadAdminService.getWithTimeline(
    req.params["id"]!
  );
  res.status(200).json({
    success: true,
    message: "Lead fetched.",
    data: { lead, activities },
  });
}

export async function updateLead(req: Request, res: Response): Promise<void> {
  const lead = await leadAdminService.update(
    req.params["id"]!,
    req.body as UpdateLeadInput,
    actor(req)
  );
  res.status(200).json({ success: true, message: "Lead updated.", data: lead });
}

export async function addNote(req: Request, res: Response): Promise<void> {
  const { note } = req.body as { note: string };
  await leadAdminService.addNote(req.params["id"]!, note, actor(req));
  res.status(201).json({ success: true, message: "Note added.", data: {} });
}

export async function assignLead(req: Request, res: Response): Promise<void> {
  const { assignedTo } = req.body as { assignedTo: string | null };
  const lead = await leadAdminService.assign(
    req.params["id"]!,
    assignedTo,
    actor(req)
  );
  res.status(200).json({ success: true, message: "Lead assigned.", data: lead });
}

export async function markSpam(req: Request, res: Response): Promise<void> {
  const { isSpam } = req.body as { isSpam: boolean };
  const lead = await leadAdminService.markSpam(
    req.params["id"]!,
    isSpam,
    actor(req)
  );
  res.status(200).json({
    success: true,
    message: isSpam ? "Marked as spam." : "Unmarked as spam.",
    data: lead,
  });
}

export async function createLead(req: Request, res: Response): Promise<void> {
  const lead = await leadAdminService.createManual(
    req.body as CreateLeadInput,
    actor(req)
  );
  res.status(201).json({ success: true, message: "Lead created.", data: lead });
}

export async function deleteLead(req: Request, res: Response): Promise<void> {
  await leadAdminService.softDelete(req.params["id"]!, actor(req));
  res.status(200).json({ success: true, message: "Lead deleted.", data: {} });
}

export async function exportLeads(req: Request, res: Response): Promise<void> {
  const q = query<LeadListQuery>(res);
  const { csv, rows } = await leadAdminService.exportCsv(q, actor(req));

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="leads-${stamp}.csv"`
  );
  res.setHeader("X-Export-Rows", String(rows));
  // BOM so Excel opens UTF-8 correctly.
  res.status(200).send(`﻿${csv}`);
}

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  const q = query<{ from?: Date; to?: Date }>(res);
  const to = q.to ?? new Date();
  const from = q.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const data = await dashboardService.summary({ from, to });
  res.status(200).json({ success: true, message: "Dashboard fetched.", data });
}
