import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live (uncached) dashboard aggregates for a freely chosen period.
 *
 * The cached KPI/leaderboard tables only cover the fixed periods (day, week,
 * payroll period, month). When a user picks a custom date range on a board we
 * therefore have to aggregate live. This hook wraps `get_sales_aggregates_v2`
 * and supports several clients at once (aggregated boards like United) plus an
 * optional set of "secondary" clients whose commission is merged into the same
 * seller row while their sales are exposed separately — identical to how the
 * cached leaderboards behave.
 */
export interface LiveDashboardSeller {
  employeeId: string;
  employeeName: string;
  salesCount: number;
  crossSaleCount: number;
  commission: number;
  revenue: number;
}

export interface LiveDashboardAggregates {
  totals: { sales: number; commission: number; revenue: number };
  secondaryTotals: { sales: number; commission: number; revenue: number };
  sellers: LiveDashboardSeller[];
}

interface AggregateRow {
  group_key: string;
  group_name: string;
  total_sales: number;
  total_commission: number;
  total_revenue: number;
}

interface Params {
  periodStart: Date;
  periodEnd: Date;
  /** Primary clients. Empty when the board is scoped by team instead. */
  clientIds?: string[];
  /** Clients whose commission merges in but whose sales are counted separately. */
  secondaryClientIds?: string[];
  teamId?: string | null;
  enabled?: boolean;
}

async function fetchEmployeeRows(
  startStr: string,
  endStr: string,
  clientId: string | null,
  teamId: string | null
): Promise<AggregateRow[]> {
  const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
    p_start: startStr,
    p_end: endStr,
    p_team_id: teamId,
    p_employee_id: null,
    p_client_id: clientId,
    p_group_by: "employee",
    p_agent_emails: null,
  });
  if (error) throw error;
  return (data ?? []) as AggregateRow[];
}

export function useLiveDashboardAggregates({
  periodStart,
  periodEnd,
  clientIds,
  secondaryClientIds,
  teamId,
  enabled = true,
}: Params) {
  const startStr = periodStart.toISOString();
  const endStr = periodEnd.toISOString();
  const primary = (clientIds ?? []).filter(Boolean);
  const secondary = (secondaryClientIds ?? []).filter(Boolean);

  return useQuery({
    queryKey: [
      "live-dashboard-aggregates",
      startStr,
      endStr,
      primary.slice().sort().join(","),
      secondary.slice().sort().join(","),
      teamId ?? "",
    ],
    queryFn: async (): Promise<LiveDashboardAggregates> => {
      const primaryCalls = primary.length > 0
        ? primary.map((id) => fetchEmployeeRows(startStr, endStr, id, null))
        : [fetchEmployeeRows(startStr, endStr, null, teamId ?? null)];

      const [primaryResults, secondaryResults] = await Promise.all([
        Promise.all(primaryCalls),
        Promise.all(secondary.map((id) => fetchEmployeeRows(startStr, endStr, id, null))),
      ]);

      const sellers = new Map<string, LiveDashboardSeller>();
      const totals = { sales: 0, commission: 0, revenue: 0 };
      const secondaryTotals = { sales: 0, commission: 0, revenue: 0 };

      const ingest = (rows: AggregateRow[], isSecondary: boolean) => {
        for (const row of rows) {
          const sales = Number(row.total_sales) || 0;
          const commission = Number(row.total_commission) || 0;
          const revenue = Number(row.total_revenue) || 0;

          const bucket = isSecondary ? secondaryTotals : totals;
          bucket.sales += sales;
          bucket.commission += commission;
          bucket.revenue += revenue;

          const existing = sellers.get(row.group_key);
          if (existing) {
            existing.commission += commission;
            existing.revenue += revenue;
            if (isSecondary) existing.crossSaleCount += sales;
            else existing.salesCount += sales;
            if (!existing.employeeName && row.group_name) existing.employeeName = row.group_name;
          } else {
            sellers.set(row.group_key, {
              employeeId: row.group_key,
              employeeName: row.group_name || row.group_key,
              salesCount: isSecondary ? 0 : sales,
              crossSaleCount: isSecondary ? sales : 0,
              commission,
              revenue,
            });
          }
        }
      };

      primaryResults.forEach((rows) => ingest(rows, false));
      secondaryResults.forEach((rows) => ingest(rows, true));

      return {
        totals,
        secondaryTotals,
        sellers: Array.from(sellers.values()).sort((a, b) => b.commission - a.commission),
      };
    },
    enabled,
    staleTime: 60000,
  });
}
