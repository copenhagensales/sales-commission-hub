import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { REFRESH_PROFILES } from "@/utils/tvMode";
import { trackFetch } from "@/utils/fetchPerformance";
import { isKpiCacheStale, logStaleCacheWarning } from "@/utils/kpiCacheStale";

export type KpiPeriod = "today" | "this_week" | "this_month" | "payroll_period" | "current" | "last_24h" | "last_7d" | "last_30d";
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
    queryFn: () => trackFetch(`kpi-${kpiSlug}`, async (): Promise<CachedKpiValue | null> => {
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

      if (data && isKpiCacheStale(data.calculated_at)) {
        logStaleCacheWarning(`precomputed-kpi:${kpiSlug}/${period}/${scopeType}`, data.calculated_at);
        return null;
      }

      return data;
    }),
    enabled: !!kpiSlug,
    ...REFRESH_PROFILES.dashboard,
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
    queryFn: () => trackFetch("kpis-batch", async (): Promise<Record<string, CachedKpiValue>> => {
      if (kpiSlugs.length === 0) return {};

      // Fetch the latest value per slug via separate queries to avoid hitting row limits
      const results: Record<string, CachedKpiValue> = {};

      await Promise.all(
        kpiSlugs.map(async (slug) => {
          let query = supabase
            .from("kpi_cached_values")
            .select("kpi_slug, value, formatted_value, calculated_at")
            .eq("kpi_slug", slug)
            .eq("period_type", period)
            .eq("scope_type", scopeType)
            .order("calculated_at", { ascending: false })
            .limit(1);

          if (scopeId) {
            query = query.eq("scope_id", scopeId);
          } else {
            query = query.is("scope_id", null);
          }

          const { data, error } = await query.maybeSingle();

          if (error) {
            console.error(`Error fetching KPI ${slug}:`, error);
            return;
          }

          if (data) {
            if (isKpiCacheStale(data.calculated_at)) {
              logStaleCacheWarning(`precomputed-kpis:${slug}/${period}/${scopeType}`, data.calculated_at);
              return;
            }
            results[data.kpi_slug] = {
              value: data.value,
              formatted_value: data.formatted_value,
              calculated_at: data.calculated_at,
            };
          }
        })
      );

      return results;
    }),
    enabled: kpiSlugs.length > 0,
    ...REFRESH_PROFILES.dashboard,
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
    queryFn: () => trackFetch("client-dashboard-kpis", async () => {
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
      const result: Partial<Record<KpiPeriod, Record<string, CachedKpiValue>>> = {
        today: {},
        this_week: {},
        this_month: {},
        payroll_period: {},
        last_24h: {},
        last_7d: {},
        last_30d: {},
      };

      let staleSkipped = 0;
      for (const item of data || []) {
        const period = item.period_type as KpiPeriod;
        if (!result[period]) continue;
        if (isKpiCacheStale(item.calculated_at)) {
          staleSkipped++;
          continue;
        }
        result[period][item.kpi_slug] = {
          value: item.value,
          formatted_value: item.formatted_value,
          calculated_at: item.calculated_at,
        };
      }
      if (staleSkipped > 0) {
        console.warn(`[client-dashboard-kpis] Skipped ${staleSkipped} stale KPI rows for client ${clientId}`);
      }

      return result;
    }),
    enabled: !!clientId,
    ...REFRESH_PROFILES.dashboard,
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
