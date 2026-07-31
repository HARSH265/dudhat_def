import { leadRepository } from "../repositories/lead.repository";

export interface DashboardRange {
  from: Date;
  to: Date;
}

/**
 * Backs the four KPI cards named in docs/CMS_BLUEPRINT.md, plus the charts in
 * docs/ADMIN_PANEL_SPECIFICATION.md §5.2.
 *
 * Product views are not included yet — the `pageviews` collection arrives with
 * the catalogue in 2C. Returning a fabricated number would be worse than
 * returning null, so the field is explicitly null and the UI can say so.
 */
export const dashboardService = {
  async summary(range: DashboardRange) {
    const previous = previousPeriod(range);

    const [
      totalLeads,
      newLeads,
      quoteRequests,
      periodLeads,
      previousLeads,
      leadsByStatus,
      leadsBySource,
      leadsOverTime,
      recentLeads,
    ] = await Promise.all([
      leadRepository.countInRange({}),
      leadRepository.countInRange({ status: "new" }),
      leadRepository.countInRange({
        type: "quote",
        createdAt: { $gte: range.from, $lte: range.to },
      }),
      leadRepository.countInRange({
        createdAt: { $gte: range.from, $lte: range.to },
      }),
      leadRepository.countInRange({
        createdAt: { $gte: previous.from, $lte: previous.to },
      }),
      leadRepository.groupBy("status", range),
      leadRepository.groupBy("source", range),
      leadRepository.countByDay(range),
      leadRepository.recent(10),
    ]);

    return {
      totalLeads,
      newLeads,
      quoteRequests,
      productViews: null as number | null,
      trends: {
        leadsThisPeriod: periodLeads,
        leadsPreviousPeriod: previousLeads,
        changePercent: percentChange(previousLeads, periodLeads),
      },
      leadsByStatus,
      leadsBySource,
      leadsOverTime,
      recentLeads,
      range: { from: range.from, to: range.to },
    };
  },
};

/** Equal-length window immediately before the requested one. */
function previousPeriod(range: DashboardRange): DashboardRange {
  const span = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - span),
    to: new Date(range.from.getTime() - 1),
  };
}

/**
 * Growth from zero is not "infinite" or "100%" — both are misleading on a
 * dashboard. Null renders as "no comparison".
 */
function percentChange(before: number, after: number): number | null {
  if (before === 0) return null;
  return Number((((after - before) / before) * 100).toFixed(1));
}
