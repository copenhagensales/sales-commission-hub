import { useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";

export interface StabilityAlert {
  id: string;
  level: "critical" | "warning" | "info";
  integration: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
}

interface IntegrationMetric {
  id: string;
  name: string;
  successRate1h: number;
  rateLimitRate15m: number;
  last_sync_at: string | null;
  lastRuns: { status: string }[];
}

interface UseStabilityAlertsParams {
  integrationMetrics: IntegrationMetric[];
  budgetUsed15m: number;
  budgetUsed60m: number;
}

export function useStabilityAlerts({
  integrationMetrics,
  budgetUsed15m,
  budgetUsed60m,
}: UseStabilityAlertsParams): StabilityAlert[] {
  const firedAlerts = useRef<Set<string>>(new Set());

  const alerts = useMemo(() => {
    const result: StabilityAlert[] = [];

    for (const int of integrationMetrics) {
      // 429-rate checks
      if (int.rateLimitRate15m > 10) {
        result.push({
          id: `429-critical-${int.id}`,
          level: "critical",
          integration: int.name,
          message: `429-rate er ${int.rateLimitRate15m.toFixed(1)}% (tærskel: 10%)`,
          metric: "rateLimitRate15m",
          value: int.rateLimitRate15m,
          threshold: 10,
        });
      } else if (int.rateLimitRate15m > 5) {
        result.push({
          id: `429-warning-${int.id}`,
          level: "warning",
          integration: int.name,
          message: `429-rate er ${int.rateLimitRate15m.toFixed(1)}% (tærskel: 5%)`,
          metric: "rateLimitRate15m",
          value: int.rateLimitRate15m,
          threshold: 5,
        });
      }

      // Success rate checks
      if (int.successRate1h < 80) {
        result.push({
          id: `success-critical-${int.id}`,
          level: "critical",
          integration: int.name,
          message: `Succes-rate er ${int.successRate1h.toFixed(0)}% (tærskel: 80%)`,
          metric: "successRate1h",
          value: int.successRate1h,
          threshold: 80,
        });
      } else if (int.successRate1h < 95) {
        result.push({
          id: `success-warning-${int.id}`,
          level: "warning",
          integration: int.name,
          message: `Succes-rate er ${int.successRate1h.toFixed(0)}% (tærskel: 95%)`,
          metric: "successRate1h",
          value: int.successRate1h,
          threshold: 95,
        });
      }

      // Last sync checks
      if (int.last_sync_at) {
        const minsSinceSync = (Date.now() - new Date(int.last_sync_at).getTime()) / 60000;
        if (minsSinceSync > 60) {
          result.push({
            id: `sync-critical-${int.id}`,
            level: "critical",
            integration: int.name,
            message: `Ingen sync i ${Math.floor(minsSinceSync)} min (tærskel: 60 min)`,
            metric: "lastSync",
            value: minsSinceSync,
            threshold: 60,
          });
        } else if (minsSinceSync > 30) {
          result.push({
            id: `sync-warning-${int.id}`,
            level: "warning",
            integration: int.name,
            message: `Ingen sync i ${Math.floor(minsSinceSync)} min (tærskel: 30 min)`,
            metric: "lastSync",
            value: minsSinceSync,
            threshold: 30,
          });
        }
      }

      // Consecutive errors
      const lastRuns = int.lastRuns || [];
      let consecutiveErrors = 0;
      for (const run of lastRuns) {
        if (run.status === "error") consecutiveErrors++;
        else break;
      }
      if (consecutiveErrors >= 5) {
        result.push({
          id: `consecutive-critical-${int.id}`,
          level: "critical",
          integration: int.name,
          message: `${consecutiveErrors} fejl i træk (tærskel: 5)`,
          metric: "consecutiveErrors",
          value: consecutiveErrors,
          threshold: 5,
        });
      } else if (consecutiveErrors >= 3) {
        result.push({
          id: `consecutive-info-${int.id}`,
          level: "info",
          integration: int.name,
          message: `${consecutiveErrors} fejl i træk (tærskel: 3)`,
          metric: "consecutiveErrors",
          value: consecutiveErrors,
          threshold: 3,
        });
      }
    }

    // Budget checks
    if (budgetUsed15m > 90) {
      result.push({
        id: "budget-15m-critical",
        level: "critical",
        integration: "Samlet",
        message: `Budget (15m) er ${budgetUsed15m.toFixed(0)}% brugt (tærskel: 90%)`,
        metric: "budgetUsed15m",
        value: budgetUsed15m,
        threshold: 90,
      });
    } else if (budgetUsed15m > 70) {
      result.push({
        id: "budget-15m-warning",
        level: "warning",
        integration: "Samlet",
        message: `Budget (15m) er ${budgetUsed15m.toFixed(0)}% brugt (tærskel: 70%)`,
        metric: "budgetUsed15m",
        value: budgetUsed15m,
        threshold: 70,
      });
    }

    if (budgetUsed60m > 90) {
      result.push({
        id: "budget-60m-critical",
        level: "critical",
        integration: "Samlet",
        message: `Budget (60m) er ${budgetUsed60m.toFixed(0)}% brugt (tærskel: 90%)`,
        metric: "budgetUsed60m",
        value: budgetUsed60m,
        threshold: 90,
      });
    } else if (budgetUsed60m > 70) {
      result.push({
        id: "budget-60m-warning",
        level: "warning",
        integration: "Samlet",
        message: `Budget (60m) er ${budgetUsed60m.toFixed(0)}% brugt (tærskel: 70%)`,
        metric: "budgetUsed60m",
        value: budgetUsed60m,
        threshold: 70,
      });
    }

    return result;
  }, [integrationMetrics, budgetUsed15m, budgetUsed60m]);

  // Fire sonner toasts for new critical/warning alerts
  useEffect(() => {
    for (const alert of alerts) {
      if (alert.level === "info") continue;
      if (firedAlerts.current.has(alert.id)) continue;
      firedAlerts.current.add(alert.id);

      if (alert.level === "critical") {
        toast.error(`${alert.integration}: ${alert.message}`);
      } else {
        toast.warning(`${alert.integration}: ${alert.message}`);
      }
    }

    // Clean up alerts that are no longer active
    const activeIds = new Set(alerts.map((a) => a.id));
    for (const id of firedAlerts.current) {
      if (!activeIds.has(id)) {
        firedAlerts.current.delete(id);
      }
    }
  }, [alerts]);

  return alerts;
}
