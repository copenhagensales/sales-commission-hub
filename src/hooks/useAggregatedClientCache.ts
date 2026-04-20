import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { REFRESH_PROFILES } from "@/utils/tvMode";
import type { LeaderboardEntry } from "@/hooks/useCachedLeaderboard";
import type { KpiPeriod } from "@/hooks/usePrecomputedKpi";

interface AggregatedKpis {
  today: { sales_count: number; total_commission: number; total_hours: number };
  this_week: { sales_count: number; total_commission: number; total_hours: number };
  payroll_period: { sales_count: number; total_commission: number; total_hours: number };
}

const EMPTY_BUCKET = { sales_count: 0, total_commission: 0, total_hours: 0 };

/**
 * Aggregate `kpi_cached_values` across multiple client IDs.
 * Used by team-style dashboards (e.g. United) that have no team-scoped cache.
 */
export function useAggregatedClientKpis(clientIds: string[] | undefined) {
  return useQuery({
    queryKey: ["aggregated-client-kpis", [...(clientIds || [])].sort()],
    queryFn: async (): Promise<AggregatedKpis> => {
      const result: AggregatedKpis = {
        today: { ...EMPTY_BUCKET },
        this_week: { ...EMPTY_BUCKET },
        payroll_period: { ...EMPTY_BUCKET },
      };
      if (!clientIds || clientIds.length === 0) return result;

      const { data, error } = await supabase
        .from("kpi_cached_values")
        .select("kpi_slug, period_type, scope_id, value")
        .eq("scope_type", "client")
        .in("scope_id", clientIds)
        .in("kpi_slug", ["sales_count", "total_commission", "total_hours"])
        .in("period_type", ["today", "this_week", "payroll_period"]);

      if (error) {
        console.error("Error fetching aggregated client KPIs:", error);
        return result;
      }

      for (const row of data || []) {
        const period = row.period_type as keyof AggregatedKpis;
        const slug = row.kpi_slug as keyof typeof EMPTY_BUCKET;
        if (!result[period] || !(slug in result[period])) continue;
        result[period][slug] += Number(row.value) || 0;
      }
      return result;
    },
    enabled: !!clientIds && clientIds.length > 0,
    ...REFRESH_PROFILES.dashboard,
  });
}

type Period = Extract<KpiPeriod, "today" | "this_week" | "payroll_period">;

interface AggregatedLeaderboards {
  sellersToday: LeaderboardEntry[];
  sellersWeek: LeaderboardEntry[];
  sellersPayroll: LeaderboardEntry[];
  isLoading: boolean;
}

function mergeLeaderboards(rows: Array<{ leaderboard_data: unknown }>): LeaderboardEntry[] {
  const map = new Map<string, LeaderboardEntry>();
  for (const row of rows) {
    const entries = Array.isArray(row.leaderboard_data) ? (row.leaderboard_data as LeaderboardEntry[]) : [];
    for (const e of entries) {
      if (!e?.employeeId) continue;
      const existing = map.get(e.employeeId);
      if (existing) {
        existing.salesCount += e.salesCount || 0;
        existing.commission += e.commission || 0;
        existing.crossSaleCount = (existing.crossSaleCount || 0) + (e.crossSaleCount || 0);
      } else {
        map.set(e.employeeId, { ...e, crossSaleCount: e.crossSaleCount || 0 });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.commission - a.commission);
}

/**
 * Aggregate `kpi_leaderboard_cache` across multiple client IDs into a unified leaderboard.
 */
export function useAggregatedClientLeaderboards(
  clientIds: string[] | undefined,
  options?: { enabled?: boolean; limit?: number }
): AggregatedLeaderboards {
  const enabled = (options?.enabled ?? true) && !!clientIds && clientIds.length > 0;
  const limit = options?.limit ?? 30;

  const fetchPeriod = async (period: Period): Promise<LeaderboardEntry[]> => {
    if (!clientIds || clientIds.length === 0) return [];
    // Get the latest row per client; we fetch all rows for these clients and pick latest per scope_id.
    const { data, error } = await supabase
      .from("kpi_leaderboard_cache")
      .select("scope_id, leaderboard_data, calculated_at")
      .eq("period_type", period)
      .eq("scope_type", "client")
      .in("scope_id", clientIds)
      .order("calculated_at", { ascending: false });

    if (error) {
      console.error(`Error fetching aggregated leaderboard (${period}):`, error);
      return [];
    }

    // Latest row per scope_id
    const latestPerScope = new Map<string, { leaderboard_data: unknown }>();
    for (const row of data || []) {
      if (!row.scope_id) continue;
      if (!latestPerScope.has(row.scope_id)) {
        latestPerScope.set(row.scope_id, { leaderboard_data: row.leaderboard_data });
      }
    }

    return mergeLeaderboards(Array.from(latestPerScope.values())).slice(0, limit);
  };

  const todayQ = useQuery({
    queryKey: ["aggregated-leaderboard", "today", [...(clientIds || [])].sort(), limit],
    queryFn: () => fetchPeriod("today"),
    enabled,
    ...REFRESH_PROFILES.dashboard,
  });
  const weekQ = useQuery({
    queryKey: ["aggregated-leaderboard", "this_week", [...(clientIds || [])].sort(), limit],
    queryFn: () => fetchPeriod("this_week"),
    enabled,
    ...REFRESH_PROFILES.dashboard,
  });
  const payrollQ = useQuery({
    queryKey: ["aggregated-leaderboard", "payroll_period", [...(clientIds || [])].sort(), limit],
    queryFn: () => fetchPeriod("payroll_period"),
    enabled,
    ...REFRESH_PROFILES.dashboard,
  });

  return {
    sellersToday: todayQ.data || [],
    sellersWeek: weekQ.data || [],
    sellersPayroll: payrollQ.data || [],
    isLoading: todayQ.isLoading || weekQ.isLoading || payrollQ.isLoading,
  };
}
