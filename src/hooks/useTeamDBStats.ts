import { useSalesAggregatesExtended, type SalesAggregatesExtended, type AggregateData } from "./useSalesAggregatesExtended";

interface TeamDBStats {
  totals: AggregateData;
  byEmployee: SalesAggregatesExtended['byEmployee'];
  byDate: SalesAggregatesExtended['byDate'];
  topPerformer: SalesAggregatesExtended['topPerformer'];
  isLoading: boolean;
  isFromRPC: boolean;
}

/**
 * Wrapper hook for team-based DB statistics.
 * Used by DBOverviewTab and CombinedSalaryTab.
 */
export function useTeamDBStats(
  periodStart: Date,
  periodEnd: Date,
  teamId?: string,
  clientId?: string,
  enabled: boolean = true
): TeamDBStats {
  const { data: aggregates, isLoading } = useSalesAggregatesExtended({
    periodStart,
    periodEnd,
    teamId,
    clientId,
    groupBy: ['date', 'employee'],
    enabled,
  });

  return {
    totals: aggregates?.totals || { sales: 0, commission: 0, revenue: 0 },
    byEmployee: aggregates?.byEmployee || {},
    byDate: aggregates?.byDate || {},
    topPerformer: aggregates?.topPerformer || null,
    isLoading,
    isFromRPC: aggregates?.isFromRPC || false,
  };
}
