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
  provider?: string;
  successRate1h: number;
  rateLimitRate15m: number;
  last_sync_at: string | null;
  lastRuns: { status: string }[];
}

/**
 * Check if current time is outside Danish working hours (21:00-08:00 Europe/Copenhagen).
 * Used to suppress alerts for Enreach integrations during off-hours.
 */
function isOutsideDanishWorkingHours(): boolean {
  const now = new Date();
  const dkHour = parseInt(
    now.toLocaleString('en-US', { 
      hour: 'numeric', hour12: false, timeZone: 'Europe/Copenhagen' 
    })
  );
  return dkHour < 8 || dkHour >= 21;
}

export interface ProviderBudget {
  provider: string;
  used1m: number;
  used60m: number;
  quotaRemaining?: number | null;
  quotaResetAt?: string | null;
}

interface UseStabilityAlertsParams {
  integrationMetrics: IntegrationMetric[];
  providerBudgets: ProviderBudget[];
}

export function useStabilityAlerts({
  integrationMetrics,
  providerBudgets,
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

      // Last sync checks – suppress for Enreach outside working hours
      const providerLower = (int.provider || "").toLowerCase();
      const isOffHoursProvider = (providerLower === "enreach" || providerLower === "adversus") && isOutsideDanishWorkingHours();

      if (isOffHoursProvider) {
        // Show info-level "paused" instead of missing-sync alerts
        result.push({
          id: `enreach-paused-${int.id}`,
          level: "info",
          integration: int.name,
          message: `Pauset (udenfor arbejdstid 21:00-08:00 DK)`,
          metric: "lastSync",
          value: 0,
          threshold: 0,
        });
      } else if (int.last_sync_at) {
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
        if (run.status === "skipped" || run.status === "skipped_locked") continue;
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

    // Per-provider budget checks
    for (const pb of providerBudgets) {
      const label = pb.provider.charAt(0).toUpperCase() + pb.provider.slice(1);

      // Quota exhaustion alert
      if (pb.quotaRemaining !== undefined && pb.quotaRemaining !== null && pb.quotaRemaining <= 0) {
        result.push({
          id: `quota-exhausted-${pb.provider}`,
          level: "critical",
          integration: label,
          message: `API-kvote opbrugt (remaining=0${pb.quotaResetAt ? `, reset: ${new Date(pb.quotaResetAt).toLocaleTimeString("da-DK")}` : ""})`,
          metric: "quotaRemaining",
          value: 0,
          threshold: 1,
        });
      }

      if (pb.used1m > 90) {
        result.push({
          id: `budget-1m-critical-${pb.provider}`,
          level: "critical",
          integration: label,
          message: `Burst limit (1m) er ${pb.used1m.toFixed(0)}% brugt (tærskel: 90%)`,
          metric: "budgetUsed1m",
          value: pb.used1m,
          threshold: 90,
        });
      } else if (pb.used1m > 70) {
        result.push({
          id: `budget-1m-warning-${pb.provider}`,
          level: "warning",
          integration: label,
          message: `Burst limit (1m) er ${pb.used1m.toFixed(0)}% brugt (tærskel: 70%)`,
          metric: "budgetUsed1m",
          value: pb.used1m,
          threshold: 70,
        });
      }

      if (pb.used60m > 90) {
        result.push({
          id: `budget-60m-critical-${pb.provider}`,
          level: "critical",
          integration: label,
          message: `Time-limit (60m) er ${pb.used60m.toFixed(0)}% brugt (tærskel: 90%)`,
          metric: "budgetUsed60m",
          value: pb.used60m,
          threshold: 90,
        });
      } else if (pb.used60m > 70) {
        result.push({
          id: `budget-60m-warning-${pb.provider}`,
          level: "warning",
          integration: label,
          message: `Time-limit (60m) er ${pb.used60m.toFixed(0)}% brugt (tærskel: 70%)`,
          metric: "budgetUsed60m",
          value: pb.used60m,
          threshold: 70,
        });
      }
    }

    return result;
  }, [integrationMetrics, providerBudgets]);

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
