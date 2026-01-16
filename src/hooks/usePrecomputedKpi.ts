import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type KpiPeriod = "today" | "this_week" | "this_month" | "payroll_period";
export type KpiScopeType = "global" | "client" | "team" | "employee";

interface CachedKpiValue {
  value: number;
  formatted_value: string | null;
  calculated_at: string;
}

/**
 * Hook to fetch pre-computed KPI values from the cache table.
 * These values are updated every 30 seconds by a background job.
 * 
 * @param kpiSlug - The KPI slug from kpi_definitions
 * @param period - Time period: 'today', 'this_week', 'this_month', 'payroll_period'
 * @param scopeType - Scope: 'global', 'client', 'team', 'employee'
 * @param scopeId - Optional scope ID (client_id, team_id, employee_id)
 */
export function usePrecomputedKpi(
  kpiSlug: string | null,
  period: KpiPeriod = "today",
  scopeType: KpiScopeType = "global",
  scopeId?: string | null
) {
  return useQuery({
    queryKey: ["precomputed-kpi", kpiSlug, period, scopeType, scopeId],
    queryFn: async (): Promise<CachedKpiValue | null> => {
      if (!kpiSlug) return null;

      let query = supabase
        .from("kpi_cached_values")
        .select("value, formatted_value, calculated_at")
        .eq("kpi_slug", kpiSlug)
        .eq("period_type", period)
        .eq("scope_type", scopeType);

      if (scopeId) {
        query = query.eq("scope_id", scopeId);
      } else {
        query = query.is("scope_id", null);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error("Error fetching precomputed KPI:", error);
        throw error;
      }

      return data;
    },
    enabled: !!kpiSlug,
    staleTime: 15000, // 15 seconds - values are updated every 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds to stay in sync
  });
}

/**
 * Hook to fetch multiple KPI values at once for dashboard efficiency.
 * 
 * @param kpiSlugs - Array of KPI slugs to fetch
 * @param period - Time period
 * @param scopeType - Scope type
 * @param scopeId - Optional scope ID
 */
export function usePrecomputedKpis(
  kpiSlugs: string[],
  period: KpiPeriod = "today",
  scopeType: KpiScopeType = "global",
  scopeId?: string | null
) {
  return useQuery({
    queryKey: ["precomputed-kpis", kpiSlugs, period, scopeType, scopeId],
    queryFn: async (): Promise<Record<string, CachedKpiValue>> => {
      if (kpiSlugs.length === 0) return {};

      let query = supabase
        .from("kpi_cached_values")
        .select("kpi_slug, value, formatted_value, calculated_at")
        .in("kpi_slug", kpiSlugs)
        .eq("period_type", period)
        .eq("scope_type", scopeType);

      if (scopeId) {
        query = query.eq("scope_id", scopeId);
      } else {
        query = query.is("scope_id", null);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching precomputed KPIs:", error);
        throw error;
      }

      // Convert array to record keyed by slug
      const result: Record<string, CachedKpiValue> = {};
      for (const item of data || []) {
        result[item.kpi_slug] = {
          value: item.value,
          formatted_value: item.formatted_value,
          calculated_at: item.calculated_at,
        };
      }

      return result;
    },
    enabled: kpiSlugs.length > 0,
    staleTime: 15000,
    refetchInterval: 30000,
  });
}

/**
 * Hook to fetch all KPI values for a client dashboard across all periods.
 * Optimized for dashboard use - fetches all periods in a single query.
 * 
 * @param clientId - The client ID
 * @param kpiSlugs - Array of KPI slugs to fetch (defaults to common sales KPIs)
 */
export function useClientDashboardKpis(
  clientId: string | null,
  kpiSlugs: string[] = ["sales_count", "total_commission", "total_revenue"]
) {
  return useQuery({
    queryKey: ["client-dashboard-kpis", clientId, kpiSlugs],
    queryFn: async () => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from("kpi_cached_values")
        .select("kpi_slug, period_type, value, formatted_value, calculated_at")
        .in("kpi_slug", kpiSlugs)
        .eq("scope_type", "client")
        .eq("scope_id", clientId);

      if (error) {
        console.error("Error fetching client dashboard KPIs:", error);
        throw error;
      }

      // Organize by period, then by slug
      const result: Record<KpiPeriod, Record<string, CachedKpiValue>> = {
        today: {},
        this_week: {},
        this_month: {},
        payroll_period: {},
      };

      for (const item of data || []) {
        const period = item.period_type as KpiPeriod;
        if (result[period]) {
          result[period][item.kpi_slug] = {
            value: item.value,
            formatted_value: item.formatted_value,
            calculated_at: item.calculated_at,
          };
        }
      }

      return result;
    },
    enabled: !!clientId,
    staleTime: 15000,
    refetchInterval: 30000,
  });
}

/**
 * Get a formatted KPI value with fallback.
 */
export function getKpiDisplay(
  kpiData: CachedKpiValue | null | undefined,
  fallback = "–"
): string {
  if (!kpiData) return fallback;
  return kpiData.formatted_value || kpiData.value.toString();
}

/**
 * Get the raw numeric value.
 */
export function getKpiValue(
  kpiData: CachedKpiValue | null | undefined,
  fallback = 0
): number {
  return kpiData?.value ?? fallback;
}
