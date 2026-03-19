import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches last 7 days of daily provision for all league players.
 * Returns Record<employeeId, number[]> where array is [day-6, day-5, ..., day-0 (today)].
 */
export function useLeagueWeeklyProvision(employeeIds: string[] | undefined) {
  return useQuery({
    queryKey: ["league-weekly-provision", employeeIds?.length],
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<Record<string, number[]>> => {
      if (!employeeIds || employeeIds.length === 0) return {};

      const now = new Date();
      const cph = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));

      // Build 7-day range
      const endDate = new Date(cph);
      const startDate = new Date(cph);
      startDate.setDate(startDate.getDate() - 6);

      const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}`;
      };

      const startStr = `${fmt(startDate)}T00:00:00+00:00`;
      const endStr = `${fmt(endDate)}T23:59:59+00:00`;

      const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
        p_start: startStr,
        p_end: endStr,
        p_group_by: "both",
      });

      if (error) throw error;

      // Build date list for consistent ordering
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        dates.push(fmt(d));
      }

      // Parse "employeeId|date" keys
      const result: Record<string, number[]> = {};
      (data || []).forEach((row: any) => {
        const key = row.group_key as string;
        if (!key || !key.includes("|")) return;
        const [empId, date] = key.split("|");
        if (!result[empId]) result[empId] = new Array(7).fill(0);
        const dayIdx = dates.indexOf(date);
        if (dayIdx >= 0) {
          result[empId][dayIdx] = Number(row.total_commission) || 0;
        }
      });

      return result;
    },
    enabled: !!employeeIds && employeeIds.length > 0,
  });
}
