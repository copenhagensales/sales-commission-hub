export interface KpiFeatureFlags {
  useUnifiedKpiSource: boolean;
  enableDualReadCompare: boolean;
  enableKpiHealthAlerts: boolean;
  enableHybridNewHireForecast: boolean;
}

export interface KpiThresholds {
  maxFreshnessLagSeconds: number;
  maxSalesDeltaPct: number;
  maxRevenueDeltaPct: number;
  maxCommissionDeltaPct: number;
}

const envBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === "true";
};

const envNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function getKpiFeatureFlags(): KpiFeatureFlags {
  const localOverride =
    typeof window !== "undefined" ? window.localStorage.getItem("useUnifiedKpiSource") : null;

  return {
    useUnifiedKpiSource:
      localOverride !== null
        ? localOverride === "true"
        : envBool(import.meta.env.VITE_USE_UNIFIED_KPI_SOURCE, false),
    enableDualReadCompare: envBool(import.meta.env.VITE_ENABLE_KPI_DUAL_READ_COMPARE, false),
    enableKpiHealthAlerts: envBool(import.meta.env.VITE_ENABLE_KPI_HEALTH_ALERTS, true),
    enableHybridNewHireForecast: envBool(import.meta.env.VITE_ENABLE_HYBRID_NEW_HIRE_FORECAST, true),
  };
}

export function getKpiThresholds(): KpiThresholds {
  return {
    maxFreshnessLagSeconds: envNumber(import.meta.env.VITE_KPI_MAX_FRESHNESS_LAG_SECONDS, 180),
    maxSalesDeltaPct: envNumber(import.meta.env.VITE_KPI_MAX_SALES_DELTA_PCT, 0.1),
    maxRevenueDeltaPct: envNumber(import.meta.env.VITE_KPI_MAX_REVENUE_DELTA_PCT, 0.25),
    maxCommissionDeltaPct: envNumber(import.meta.env.VITE_KPI_MAX_COMMISSION_DELTA_PCT, 0.25),
  };
}
