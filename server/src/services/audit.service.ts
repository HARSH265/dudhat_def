import type { Types } from "mongoose";
import ActivityLog, { type AuditAction } from "../models/ActivityLog";
import { logger } from "../config/logger";

export interface AuditEntry {
  userId?: Types.ObjectId;
  action: AuditAction;
  entityType: string;
  entityId?: Types.ObjectId;
  changes?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
}

export const auditService = {
  /**
   * Never throws. An audit write failing must not fail the operation the
   * user asked for — but it must be visible in the logs.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await ActivityLog.create(entry);
    } catch (error) {
      logger.error({ err: error, entry: { ...entry, changes: undefined } },
        "Failed to write audit log");
    }
  },
};
