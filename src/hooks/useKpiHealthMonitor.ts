import { useEffect, useMemo } from "react";
import { getKpiFeatureFlags, getKpiThresholds } from "@/config/kpiRuntime";

export interface KpiSnapshot {
  totalSales: number;
  totalRevenue: number;
  totalCommission: number;
  dataAsOf: string;
}

export interface KpiHealthState {
  freshnessLagSeconds: number;
  salesDeltaPct: number;
  revenueDeltaPct: number;
  commissionDeltaPct: number;
  freshnessBreached: boolean;
  correctnessBreached: boolean;
}

const pctDelta = (a: number, b: number): number => {
  if (a === 0 && b === 0) return 0;
  const base = Math.max(1, Math.abs(b));
  return (Math.abs(a - b) / base) * 100;
};

export function useKpiHealthMonitor(current: KpiSnapshot, baseline?: KpiSnapshot | null): KpiHealthState {
  const flags = getKpiFeatureFlags();
  const thresholds = getKpiThresholds();

  const state = useMemo(() => {
    const freshnessLagSeconds = Math.max(0, (Date.now() - new Date(current.dataAsOf).getTime()) / 1000);
    const salesDeltaPct = baseline ? pctDelta(current.totalSales, baseline.totalSales) : 0;
    const revenueDeltaPct = baseline ? pctDelta(current.totalRevenue, baseline.totalRevenue) : 0;
    const commissionDeltaPct = baseline ? pctDelta(current.totalCommission, baseline.totalCommission) : 0;

    const freshnessBreached = freshnessLagSeconds > thresholds.maxFreshnessLagSeconds;
    const correctnessBreached =
      baseline !== undefined &&
      baseline !== null &&
      (salesDeltaPct > thresholds.maxSalesDeltaPct ||
        revenueDeltaPct > thresholds.maxRevenueDeltaPct ||
        commissionDeltaPct > thresholds.maxCommissionDeltaPct);

    return {
      freshnessLagSeconds,
      salesDeltaPct,
      revenueDeltaPct,
      commissionDeltaPct,
      freshnessBreached,
      correctnessBreached,
    };
  }, [baseline, current.dataAsOf, current.totalCommission, current.totalRevenue, current.totalSales, thresholds]);

  useEffect(() => {
    if (!flags.enableKpiHealthAlerts) return;

    if (state.freshnessBreached) {
      console.warn("[kpi-health] Freshness threshold breached", {
        lagSeconds: state.freshnessLagSeconds,
        threshold: thresholds.maxFreshnessLagSeconds,
      });
    }

    if (flags.enableDualReadCompare && state.correctnessBreached) {
      console.warn("[kpi-health] Dual-read correctness threshold breached", {
        salesDeltaPct: state.salesDeltaPct,
        revenueDeltaPct: state.revenueDeltaPct,
        commissionDeltaPct: state.commissionDeltaPct,
        thresholds,
      });
    }
  }, [flags, state, thresholds]);

  return state;
}
