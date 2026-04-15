import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CpoRevenueData {
  /** Total CPO revenue across all employees/dates */
  total: number;
  /** CPO revenue grouped by employee_id */
  byEmployee: Record<string, number>;
  /** CPO revenue grouped by date (YYYY-MM-DD) */
  byDate: Record<string, number>;
  /** CPO revenue grouped by client_id */
  byClient: Record<string, number>;
}

/**
 * Calculates CPO-based revenue from time_stamps × employee_time_clocks.cpo_per_hour.
 * Matches on employee_id + client_id to find correct CPO rate.
 */
export function useCpoRevenue(opts: {
  periodStart: Date;
  periodEnd: Date;
  teamId?: string;
  clientId?: string;
  enabled?: boolean;
}) {
  const { periodStart, periodEnd, teamId, clientId, enabled = true } = opts;

  return useQuery<CpoRevenueData>({
    queryKey: [
      "cpo-revenue",
      periodStart.toISOString(),
      periodEnd.toISOString(),
      teamId,
      clientId,
    ],
    queryFn: async () => {
      // 1. Get all active time clocks with cpo_per_hour > 0
      let clocksQuery = supabase
        .from("employee_time_clocks")
        .select("employee_id, client_id, cpo_per_hour")
        .eq("is_active", true)
        .gt("cpo_per_hour", 0);

      if (clientId) {
        clocksQuery = clocksQuery.eq("client_id", clientId);
      }

      const { data: clocks, error: clocksError } = await clocksQuery;
      if (clocksError) throw clocksError;
      if (!clocks || clocks.length === 0) {
        return { total: 0, byEmployee: {}, byDate: {}, byClient: {} };
      }

      // Build a lookup: key = "employeeId|clientId" → cpo_per_hour
      const cpoMap = new Map<string, number>();
      const relevantEmployeeIds = new Set<string>();
      for (const clock of clocks) {
        const key = `${clock.employee_id}|${clock.client_id || ""}`;
        cpoMap.set(key, clock.cpo_per_hour);
        relevantEmployeeIds.add(clock.employee_id);
      }

      // If teamId filter, narrow employees to team members
      let teamEmployeeIds: Set<string> | null = null;
      if (teamId) {
        const { data: members } = await supabase
          .from("team_members")
          .select("employee_id")
          .eq("team_id", teamId);
        teamEmployeeIds = new Set((members || []).map((m) => m.employee_id));
      }

      // 2. Fetch time_stamps for relevant employees in period
      const employeeIdsArray = Array.from(relevantEmployeeIds).filter(
        (id) => !teamEmployeeIds || teamEmployeeIds.has(id)
      );

      if (employeeIdsArray.length === 0) {
        return { total: 0, byEmployee: {}, byDate: {}, byClient: {} };
      }

      let tsQuery = supabase
        .from("time_stamps")
        .select("employee_id, client_id, effective_hours, clock_in")
        .in("employee_id", employeeIdsArray)
        .gte("clock_in", periodStart.toISOString())
        .lte("clock_in", periodEnd.toISOString())
        .not("effective_hours", "is", null);

      if (clientId) {
        tsQuery = tsQuery.eq("client_id", clientId);
      }

      const { data: timestamps, error: tsError } = await tsQuery;
      if (tsError) throw tsError;

      // 3. Calculate revenue
      const byEmployee: Record<string, number> = {};
      const byDate: Record<string, number> = {};
      const byClient: Record<string, number> = {};
      let total = 0;

      for (const ts of timestamps || []) {
        const hours = ts.effective_hours || 0;
        if (hours <= 0) continue;

        // Match clock: try with client_id first, then without
        const keyWithClient = `${ts.employee_id}|${ts.client_id || ""}`;
        const keyNoClient = `${ts.employee_id}|`;
        const cpoRate = cpoMap.get(keyWithClient) ?? cpoMap.get(keyNoClient);

        if (!cpoRate || cpoRate <= 0) continue;

        const revenue = hours * cpoRate;
        total += revenue;

        byEmployee[ts.employee_id] = (byEmployee[ts.employee_id] || 0) + revenue;

        const date = ts.clock_in.split("T")[0];
        byDate[date] = (byDate[date] || 0) + revenue;

        if (ts.client_id) {
          byClient[ts.client_id] = (byClient[ts.client_id] || 0) + revenue;
        }
      }

      return { total, byEmployee, byDate, byClient };
    },
    enabled,
  });
}
