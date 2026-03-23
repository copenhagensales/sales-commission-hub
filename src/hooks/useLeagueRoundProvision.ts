import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches provision for all employees scoped to a specific round's date range.
 */
export function useLeagueRoundProvision(
  round: { start_date: string; end_date: string } | null | undefined,
  employeeIds: string[] | undefined
) {
  return useQuery({
    queryKey: ["league-round-provision", round?.start_date, round?.end_date, employeeIds?.length],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<Record<string, number>> => {
      if (!round || !employeeIds || employeeIds.length === 0) return {};

      const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
        p_start: round.start_date,
        p_end: round.end_date,
        p_group_by: "employee",
      });

      if (error) throw error;

      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        if (row.group_key) {
          map[row.group_key] = Number(row.total_commission) || 0;
        }
      });
      return map;
    },
    enabled: !!round && !!employeeIds && employeeIds.length > 0,
  });
}
