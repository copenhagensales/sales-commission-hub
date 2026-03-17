import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PrizeLeader {
  employee: { id: string; first_name: string; last_name: string } | null;
  value: number;
  label: string;
}

export interface RankedPlayer {
  employee: { id: string; first_name: string; last_name: string } | null;
  total_points: number;
}

export interface RankedRound {
  employee: { id: string; first_name: string; last_name: string } | null;
  points_earned: number;
  round_number: number | null;
}

export interface RankedComeback {
  employee: { id: string; first_name: string; last_name: string } | null;
  improvement: number;
}

export interface PrizeLeaders {
  bestRound: PrizeLeader | null;
  talent: PrizeLeader | null;
  comeback: PrizeLeader | null;
  allByPoints: RankedPlayer[];
  allBestRounds: RankedRound[];
  allTalents: RankedPlayer[];
  allComebacks: RankedComeback[];
}

export function usePrizeLeaders(seasonId: string | undefined, seasonStartDate: string | undefined) {
  return useQuery({
    queryKey: ["league-prize-leaders", seasonId],
    staleTime: 60000,
    queryFn: async (): Promise<PrizeLeaders> => {
      const empty: PrizeLeaders = {
        bestRound: null, talent: null, comeback: null,
        allByPoints: [], allBestRounds: [], allTalents: [], allComebacks: [],
      };
      if (!seasonId) return empty;

      // --- All by points (for Top 3 dialog) ---
      const { data: allStandings } = await supabase
        .from("league_season_standings")
        .select(`
          total_points,
          employee:employee_master_data!league_season_standings_employee_id_fkey(
            id, first_name, last_name, employment_start_date
          )
        `)
        .eq("season_id", seasonId)
        .order("total_points", { ascending: false });

      const allByPoints: RankedPlayer[] = (allStandings ?? [])
        .filter((s: any) => s.total_points > 0)
        .map((s: any) => ({
          employee: s.employee ? { id: s.employee.id, first_name: s.employee.first_name, last_name: s.employee.last_name } : null,
          total_points: s.total_points,
        }));

      // --- Best rounds ---
      const { data: roundStandings } = await supabase
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
        .limit(50);

      // Get round numbers for all round_ids
      const roundIds = [...new Set((roundStandings ?? []).map((r: any) => r.round_id).filter(Boolean))];
      const roundNumberMap: Record<string, number> = {};
      if (roundIds.length > 0) {
        const { data: rounds } = await supabase
          .from("league_rounds")
          .select("id, round_number")
          .in("id", roundIds);
        (rounds ?? []).forEach((r: any) => { roundNumberMap[r.id] = r.round_number; });
      }

      const allBestRounds: RankedRound[] = (roundStandings ?? [])
        .filter((r: any) => r.points_earned > 0)
        .map((r: any) => ({
          employee: r.employee as any,
          points_earned: r.points_earned,
          round_number: r.round_id ? (roundNumberMap[r.round_id] ?? null) : null,
        }));

      const bestRound: PrizeLeader | null = allBestRounds.length > 0
        ? {
            employee: allBestRounds[0].employee,
            value: allBestRounds[0].points_earned,
            label: `${allBestRounds[0].points_earned} pt${allBestRounds[0].round_number ? ` (runde ${allBestRounds[0].round_number})` : ""}`,
          }
        : null;

      // --- Talent: < 3 months employment at season start ---
      let allTalents: RankedPlayer[] = [];
      let talent: PrizeLeader | null = null;
      if (seasonStartDate && allStandings) {
        const cutoffDate = new Date(seasonStartDate);
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        const cutoffStr = cutoffDate.toISOString().split("T")[0];

        allTalents = (allStandings as any[])
          .filter((s: any) => {
            const emp = s.employee;
            return emp?.employment_start_date && emp.employment_start_date > cutoffStr && s.total_points > 0;
          })
          .map((s: any) => ({
            employee: { id: s.employee.id, first_name: s.employee.first_name, last_name: s.employee.last_name },
            total_points: s.total_points,
          }));

        if (allTalents.length > 0) {
          talent = {
            employee: allTalents[0].employee,
            value: allTalents[0].total_points,
            label: `${allTalents[0].total_points} pt`,
          };
        }
      }

      // --- Comeback: rank improvement from round 1 ---
      let allComebacks: RankedComeback[] = [];
      let comeback: PrizeLeader | null = null;

      const { data: round1 } = await supabase
        .from("league_rounds")
        .select("id")
        .eq("season_id", seasonId)
        .eq("round_number", 1)
        .maybeSingle();

      if (round1) {
        const { data: round1Standings } = await supabase
          .from("league_round_standings")
          .select("employee_id, division, rank_in_division")
          .eq("round_id", round1.id)
          .order("division", { ascending: true })
          .order("rank_in_division", { ascending: true });

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
          const startRankMap: Record<string, number> = {};
          round1Standings.forEach((s, idx) => { startRankMap[s.employee_id] = idx + 1; });

          const comebackEntries: RankedComeback[] = [];
          for (const cs of currentStandings) {
            const startRank = startRankMap[cs.employee_id];
            if (startRank == null) continue;
            const improvement = startRank - cs.overall_rank;
            if (improvement > 0) {
              comebackEntries.push({
                employee: cs.employee as any,
                improvement,
              });
            }
          }
          allComebacks = comebackEntries.sort((a, b) => b.improvement - a.improvement);

          if (allComebacks.length > 0) {
            comeback = {
              employee: allComebacks[0].employee,
              value: allComebacks[0].improvement,
              label: `+${allComebacks[0].improvement} pladser`,
            };
          }
        }
      }

      return { bestRound, talent, comeback, allByPoints, allBestRounds, allTalents, allComebacks };
    },
    enabled: !!seasonId,
  });
}
