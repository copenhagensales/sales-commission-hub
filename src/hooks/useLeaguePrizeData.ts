import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PrizeLeader {
  employee: { id: string; first_name: string; last_name: string } | null;
  value: number;
  label: string;
}

export interface PrizeLeaders {
  bestRound: PrizeLeader | null;
  talent: PrizeLeader | null;
  comeback: PrizeLeader | null;
}

export function usePrizeLeaders(seasonId: string | undefined, seasonStartDate: string | undefined) {
  return useQuery({
    queryKey: ["league-prize-leaders", seasonId],
    staleTime: 60000,
    queryFn: async (): Promise<PrizeLeaders> => {
      if (!seasonId) return { bestRound: null, talent: null, comeback: null };

      // 1. Best round: highest points_earned in a single round
      const { data: bestRoundData } = await supabase
        .from("league_round_standings")
        .select(`
          points_earned,
          round_id,
          employee:employee_master_data!league_round_standings_employee_id_fkey(
            id, first_name, last_name
          )
        `)
        .eq("season_id", seasonId)
        .order("points_earned", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get round number for best round
      let bestRoundNumber: number | null = null;
      if (bestRoundData?.round_id) {
        const { data: roundData } = await supabase
          .from("league_rounds")
          .select("round_number")
          .eq("id", bestRoundData.round_id)
          .maybeSingle();
        bestRoundNumber = roundData?.round_number ?? null;
      }

      const bestRound: PrizeLeader | null = bestRoundData?.employee
        ? {
            employee: bestRoundData.employee as any,
            value: bestRoundData.points_earned,
            label: `${bestRoundData.points_earned} pt${bestRoundNumber ? ` (runde ${bestRoundNumber})` : ""}`,
          }
        : null;

      // 2. Talent: most points among players with < 3 months employment at season start
      let talent: PrizeLeader | null = null;
      if (seasonStartDate) {
        const cutoffDate = new Date(seasonStartDate);
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        const cutoffStr = cutoffDate.toISOString().split("T")[0];

        const { data: standingsWithDates } = await supabase
          .from("league_season_standings")
          .select(`
            total_points,
            employee:employee_master_data!league_season_standings_employee_id_fkey(
              id, first_name, last_name, employment_start_date
            )
          `)
          .eq("season_id", seasonId)
          .order("total_points", { ascending: false });

        if (standingsWithDates) {
          for (const s of standingsWithDates) {
            const emp = s.employee as any;
            if (emp?.employment_start_date && emp.employment_start_date > cutoffStr) {
              talent = {
                employee: { id: emp.id, first_name: emp.first_name, last_name: emp.last_name },
                value: s.total_points,
                label: `${s.total_points} pt`,
              };
              break;
            }
          }
        }
      }

      // 3. Comeback: biggest rank improvement from round 1 to current overall_rank
      let comeback: PrizeLeader | null = null;

      // Find round 1
      const { data: round1 } = await supabase
        .from("league_rounds")
        .select("id")
        .eq("season_id", seasonId)
        .eq("round_number", 1)
        .maybeSingle();

      if (round1) {
        // Get round 1 standings to compute initial overall rank
        const { data: round1Standings } = await supabase
          .from("league_round_standings")
          .select("employee_id, division, rank_in_division")
          .eq("round_id", round1.id)
          .order("division", { ascending: true })
          .order("rank_in_division", { ascending: true });

        // Get current season standings
        const { data: currentStandings } = await supabase
          .from("league_season_standings")
          .select(`
            employee_id,
            overall_rank,
            employee:employee_master_data!league_season_standings_employee_id_fkey(
              id, first_name, last_name
            )
          `)
          .eq("season_id", seasonId);

        if (round1Standings && currentStandings) {
          // Compute global rank from round 1 (division-first, then rank_in_division)
          const startRankMap: Record<string, number> = {};
          round1Standings.forEach((s, idx) => {
            startRankMap[s.employee_id] = idx + 1;
          });

          let maxImprovement = 0;
          let comebackPlayer: PrizeLeader | null = null;

          for (const cs of currentStandings) {
            const startRank = startRankMap[cs.employee_id];
            if (startRank == null) continue;
            const improvement = startRank - cs.overall_rank;
            if (improvement > maxImprovement) {
              maxImprovement = improvement;
              comebackPlayer = {
                employee: cs.employee as any,
                value: improvement,
                label: `+${improvement} pladser`,
              };
            }
          }

          if (comebackPlayer && maxImprovement > 0) {
            comeback = comebackPlayer;
          }
        }
      }

      return { bestRound, talent, comeback };
    },
    enabled: !!seasonId,
  });
}
