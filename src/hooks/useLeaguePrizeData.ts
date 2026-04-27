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

export function usePrizeLeaders(
  seasonId: string | undefined,
  seasonStartDate: string | undefined,
  currentRoundNumber?: number
) {
  return useQuery({
    queryKey: ["league-prize-leaders", seasonId, currentRoundNumber],
    staleTime: 60000,
    queryFn: async (): Promise<PrizeLeaders> => {
      const empty: PrizeLeaders = {
        bestRound: null, talent: null, comeback: null,
        allByPoints: [], allBestRounds: [], allTalents: [], allComebacks: [],
      };
      if (!seasonId) return empty;

      // Check season status
      const { data: seasonData } = await supabase
        .from("league_seasons")
        .select("status")
        .eq("id", seasonId)
        .maybeSingle();

      const isActive = seasonData?.status === "active";
      const usePointsForTalent = isActive && currentRoundNumber != null && currentRoundNumber >= 2;

      // --- All by points (for Top 3 dialog) ---
      const { data: allStandings } = isActive
        ? await supabase
            .from("league_season_standings")
            .select(`
              total_points,
              employee:employee_master_data!league_season_standings_employee_id_fkey(
                id, first_name, last_name, employment_start_date
              )
            `)
            .eq("season_id", seasonId)
            .order("total_points", { ascending: false })
        : { data: null };

      const allByPoints: RankedPlayer[] = (allStandings ?? [])
        .filter((s: any) => s.total_points > 0)
        .map((s: any) => ({
          employee: s.employee ? { id: s.employee.id, first_name: s.employee.first_name, last_name: s.employee.last_name } : null,
          total_points: s.total_points,
        }));

      // --- Best rounds ---
      let bestRound: PrizeLeader | null = null;
      let allBestRounds: RankedRound[] = [];

      // Always fetch qualification best for "Bedste Runde" (kval counts as a round)
      const { data: qualBestStandings } = await supabase
        .from("league_qualification_standings")
        .select(`
          current_provision,
          employee:employee_master_data!league_qualification_standings_employee_id_fkey(id, first_name, last_name)
        `)
        .eq("season_id", seasonId)
        .order("current_provision", { ascending: false })
        .limit(50);

      const qualBestRounds: RankedRound[] = (qualBestStandings ?? [])
        .filter((s: any) => (s.current_provision || 0) > 0)
        .map((s: any) => ({
          employee: { id: s.employee.id, first_name: s.employee.first_name, last_name: s.employee.last_name },
          points_earned: Math.round(s.current_provision),
          round_number: 0, // 0 = Kval
        }));

      if (isActive) {
        // "Bedste runde" = højeste provision (kr) opnået i én enkelt runde.
        // Vi henter weekly_provision (kr) — IKKE points_earned — så kval og rounds
        // sammenlignes i samme enhed (kroner).
        const { data: roundStandings } = await supabase
          .from("league_round_standings")
          .select(`
            weekly_provision, round_id,
            employee:employee_master_data!league_round_standings_employee_id_fkey(id, first_name, last_name)
          `)
          .eq("season_id", seasonId)
          .order("weekly_provision", { ascending: false })
          .limit(50);

        const roundIds = [...new Set((roundStandings ?? []).map((r: any) => r.round_id).filter(Boolean))];
        const roundNumberMap: Record<string, number> = {};
        if (roundIds.length > 0) {
          const { data: rounds } = await supabase.from("league_rounds").select("id, round_number").in("id", roundIds);
          (rounds ?? []).forEach((r: any) => { roundNumberMap[r.id] = r.round_number; });
        }

        const finishedBestRounds: RankedRound[] = (roundStandings ?? [])
          .filter((r: any) => (r.weekly_provision || 0) > 0)
          .map((r: any) => ({
            employee: r.employee as any,
            points_earned: Math.round(r.weekly_provision), // feltnavnet bevares for bagudkompatibilitet — værdien er kr
            round_number: r.round_id ? (roundNumberMap[r.round_id] ?? null) : null,
          }));

        // Merge kval + finished rounds, sortér efter provision (kr) faldende
        allBestRounds = [...qualBestRounds, ...finishedBestRounds]
          .sort((a, b) => b.points_earned - a.points_earned);

        if (allBestRounds.length > 0) {
          const top = allBestRounds[0];
          const roundLabel = top.round_number === 0 ? "kval" : top.round_number ? `runde ${top.round_number}` : "";
          bestRound = {
            employee: top.employee,
            value: top.points_earned,
            label: `${top.points_earned.toLocaleString("da-DK")} kr${roundLabel ? ` (${roundLabel})` : ""}`,
          };
        }
      } else {
        // Qualification phase only
        allBestRounds = qualBestRounds;
        if (qualBestRounds.length > 0) {
          const top = qualBestRounds[0];
          bestRound = {
            employee: top.employee,
            value: top.points_earned,
            label: `${top.points_earned.toLocaleString("da-DK")} kr`,
          };
        }
      }

      // --- Talent: < 3 months employment at season start ---
      let allTalents: RankedPlayer[] = [];
      let talent: PrizeLeader | null = null;

      if (seasonStartDate) {
        const cutoffDate = new Date(seasonStartDate);
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        const cutoffStr = cutoffDate.toISOString().split("T")[0];

        if (usePointsForTalent && allStandings) {
          // Round 2+: use points
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
        } else {
          // Qualification or Round 1: use provision
          const { data: qualData } = await supabase
            .from("league_qualification_standings")
            .select(`
              current_provision,
              employee:employee_master_data!league_qualification_standings_employee_id_fkey(
                id, first_name, last_name, employment_start_date
              )
            `)
            .eq("season_id", seasonId)
            .order("current_provision", { ascending: false });

          const talentCandidates = (qualData ?? [])
            .filter((s: any) => {
              const emp = s.employee;
              return emp?.employment_start_date && emp.employment_start_date > cutoffStr && (s.current_provision || 0) > 0;
            });

          allTalents = talentCandidates.map((s: any) => ({
            employee: { id: s.employee.id, first_name: s.employee.first_name, last_name: s.employee.last_name },
            total_points: s.current_provision || 0,
          }));

          if (talentCandidates.length > 0) {
            const top = talentCandidates[0] as any;
            talent = {
              employee: { id: top.employee.id, first_name: top.employee.first_name, last_name: top.employee.last_name },
              value: top.current_provision,
              label: `${Math.round(top.current_provision).toLocaleString("da-DK")} kr`,
            };
          }
        }
      }

      // --- Comeback: rank improvement from round 1 ---
      let allComebacks: RankedComeback[] = [];
      let comeback: PrizeLeader | null = null;

      if (isActive) {
        // Use qualification final ranking as baseline for comeback
        const { data: qualRankings } = await supabase
          .from("league_qualification_standings")
          .select("employee_id, overall_rank")
          .eq("season_id", seasonId);

        const { data: currentStandings } = await supabase
          .from("league_season_standings")
          .select(`
            employee_id, overall_rank,
            employee:employee_master_data!league_season_standings_employee_id_fkey(id, first_name, last_name)
          `)
          .eq("season_id", seasonId);

        if (qualRankings && currentStandings) {
          const qualRankMap: Record<string, number> = {};
          qualRankings.forEach((s: any) => { qualRankMap[s.employee_id] = s.overall_rank; });

          const comebackEntries: RankedComeback[] = [];
          for (const cs of currentStandings) {
            const kvalRank = qualRankMap[cs.employee_id];
            if (kvalRank == null) continue;
            const improvement = kvalRank - cs.overall_rank;
            if (improvement > 0) {
              comebackEntries.push({ employee: cs.employee as any, improvement });
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
      } else {
        // Qualification: biggest rank improvement
        const { data: qualStandings } = await supabase
          .from("league_qualification_standings")
          .select(`
            overall_rank, previous_overall_rank,
            employee:employee_master_data!league_qualification_standings_employee_id_fkey(id, first_name, last_name)
          `)
          .eq("season_id", seasonId);

        if (qualStandings) {
          const comebackEntries: RankedComeback[] = [];
          for (const s of qualStandings as any[]) {
            if (s.previous_overall_rank != null && s.previous_overall_rank > s.overall_rank) {
              comebackEntries.push({
                employee: s.employee,
                improvement: s.previous_overall_rank - s.overall_rank,
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
