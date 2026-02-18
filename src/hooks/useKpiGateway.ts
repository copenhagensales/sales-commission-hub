import { useMemo } from "react";
import { useDashboardSalesData } from "@/hooks/useDashboardSalesData";
import { getMetricContractVersion } from "@/lib/metricContract";
import { getKpiFeatureFlags } from "@/config/kpiRuntime";
import { type KpiSnapshot, useKpiHealthMonitor } from "@/hooks/useKpiHealthMonitor";

interface UseKpiGatewayParams {
  clientId?: string;
  clientName?: string;
  startDate: Date;
  endDate: Date;
  teamId?: string;
  enabled?: boolean;
  maxStaleMs?: number;
  legacySnapshot?: KpiSnapshot | null;
}

export interface UnifiedKpiGatewayData {
  source: "unified" | "legacy";
  contractVersion: string;
  dataAsOf: string;
  isStale: boolean;
  totalSales: number;
  totalRevenue: number;
  totalCommission: number;
  totalHours: number;
  employeeStats: Array<{
    employeeId: string;
    employeeName: string;
    teamName: string | null;
    totalHours: number;
    totalSales: number;
    totalRevenue: number;
    totalCommission: number;
  }>;
  isLoading: boolean;
  health: {
    freshnessLagSeconds: number;
    salesDeltaPct: number;
    revenueDeltaPct: number;
    commissionDeltaPct: number;
    freshnessBreached: boolean;
    correctnessBreached: boolean;
  };
}

/**
 * Unified KPI gateway hook.
 *
 * This provides one consistent entrypoint for dashboard KPI cards,
 * including freshness metadata (`dataAsOf`, `isStale`) and contract version.
 */
export function useKpiGateway(params: UseKpiGatewayParams): UnifiedKpiGatewayData {
  const maxStaleMs = params.maxStaleMs ?? 2 * 60 * 1000;
  const dashboardData = useDashboardSalesData(params);
  const flags = getKpiFeatureFlags();

  const baseline = flags.enableDualReadCompare ? params.legacySnapshot : null;

  const health = useKpiHealthMonitor(
    {
      totalSales: dashboardData.totalSales,
      totalRevenue: dashboardData.totalRevenue,
      totalCommission: dashboardData.totalCommission,
      dataAsOf: dashboardData.dataAsOf ?? new Date(0).toISOString(),
    },
    baseline
  );

  return useMemo(() => {
    const dataAsOf = dashboardData.dataAsOf ?? new Date(0).toISOString();
    const isStale = Date.now() - new Date(dataAsOf).getTime() > maxStaleMs;

    return {
      source: flags.useUnifiedKpiSource ? "unified" : "legacy",
      contractVersion: getMetricContractVersion(),
      dataAsOf,
      isStale,
      totalSales: dashboardData.totalSales,
      totalRevenue: dashboardData.totalRevenue,
      totalCommission: dashboardData.totalCommission,
      totalHours: dashboardData.totalHours,
      employeeStats: dashboardData.employeeStats,
      isLoading: dashboardData.isLoading,
      health,
    };
  }, [
    dashboardData.totalSales,
    dashboardData.totalRevenue,
    dashboardData.totalCommission,
    dashboardData.totalHours,
    dashboardData.employeeStats,
    dashboardData.dataAsOf,
    dashboardData.isLoading,
    health,
    maxStaleMs,
    flags.useUnifiedKpiSource,
  ]);
}
