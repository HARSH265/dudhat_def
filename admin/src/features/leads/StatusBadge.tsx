import type { LeadStatus } from "@/types/api";
import { STATUS_LABEL } from "./leads.api";
import { cn } from "@/lib/utils";

/**
 * Colour is never the only signal — every badge carries its label in text.
 * The palette is shared with the dashboard and the board; a status that is
 * amber in one view and purple in another costs more than it saves.
 * docs/ADMIN_UI_ARCHITECTURE.md §6
 */
const STYLES: Record<LeadStatus, string> = {
  new: "bg-brand-50 text-brand-700 border-brand-100",
  contacted: "bg-cyan-50 text-cyan-800 border-cyan-200",
  qualified: "bg-violet-50 text-violet-800 border-violet-200",
  quotation_sent: "bg-amber-50 text-amber-800 border-amber-200",
  won: "bg-accent-50 text-accent-600 border-green-200",
  lost: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusBadge({
  status,
  className,
}: {
  status: LeadStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLES[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
