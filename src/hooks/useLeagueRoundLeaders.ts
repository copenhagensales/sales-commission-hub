import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeagueRoundLeader {
  employee_id: string;
  provision: number;
  deals: number;
}

/**
 * Provision og antal salg pr. medarbejder inden for en rundes datointerval.
 * Bruges til "denne uge"-visningen paa forsiden.
 */
export function useLeagueRoundLeaders(
  round: { start_date: string; end_date: string } | null | undefined
) {
  return useQuery({
    queryKey: ["league-round-leaders", round?.start_date, round?.end_date],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<Record<string, LeagueRoundLeader>> => {
      if (!round) return {};

      const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
        p_start: round.start_date,
        p_end: round.end_date,
        p_group_by: "employee",
      });

      if (error) throw error;

      const map: Record<string, LeagueRoundLeader> = {};
      (data || []).forEach((row) => {
        if (!row.group_key) return;
        map[row.group_key] = {
          employee_id: row.group_key,
          provision: Number(row.total_commission) || 0,
          deals: Number(row.total_sales) || 0,
        };
      });
      return map;
    },
    enabled: !!round,
  });
}
