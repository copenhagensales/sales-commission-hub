import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LeagueSeason } from "./useLeagueData";

/** Hold der ikke deltager i holdkonkurrencen (ikke sælgere) */
export const TEAM_COMPETITION_EXCLUDED_TEAMS = ["Stab"];

/** Antal sælgere pr. hold der tæller i holdets total */
export const TEAM_COMPETITION_COUNTING_PLAYERS = 5;


export interface TeamCompetitionPlayer {
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  provision: number;
  today_provision: number;
  counts: boolean;
}

export interface TeamCompetitionRow {
  team_id: string;
  team_name: string;
  provision: number;
  today_provision: number;
  rank: number;
  previous_rank: number;
  rank_change: number;
  players: TeamCompetitionPlayer[];
  counting_players: TeamCompetitionPlayer[];
}

export interface TeamCompetitionData {
  hasStarted: boolean;
  periodStart: string;
  periodEnd: string;
  teams: TeamCompetitionRow[];
  totalTeams: number;
  totalPlayers: number;
  countingPlayers: number;
}

function toCopenhagenToday(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
}

function toDateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Konvertér et timestamptz til dato (YYYY-MM-DD) i dansk tid */
function toCopenhagenDateOnly(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return toDateOnly(new Date(d.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" })));
}


async function fetchProvisionByEmployee(
  start: string,
  end: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
    p_start: start,
    p_end: end,
    p_group_by: "employee",
  });
  if (error) throw error;
  const map: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    if (row.group_key) map[row.group_key] = Number(row.total_commission) || 0;
  });
  return map;
}

function rankTeams(totals: Array<{ team_id: string; provision: number }>): Record<string, number> {
  const sorted = [...totals].sort((a, b) => b.provision - a.provision);
  const ranks: Record<string, number> = {};
  sorted.forEach((t, i) => {
    ranks[t.team_id] = i + 1;
  });
  return ranks;
}

/**
 * Holdkonkurrence: én samlet konkurrence over hele sæsonperioden (efter kvalifikationen).
 * Kun de 5 sælgere med højest provision pr. hold tæller i holdets total.
 */
export function useLeagueTeamCompetition(season: LeagueSeason | null | undefined) {
  // Holdkonkurrencen starter på kvalifikationsrundens første dag (dansk tid)
  const teamStartDate = season
    ? toCopenhagenDateOnly(
        season.qualification_source_start || season.qualification_start_at
      ) || season.start_date
    : undefined;

  return useQuery({
    queryKey: ["league-team-competition", season?.id, teamStartDate],
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled: !!season?.id,
    queryFn: async (): Promise<TeamCompetitionData> => {
      const today = toCopenhagenToday();
      const todayStr = toDateOnly(today);
      const startDate = teamStartDate || season!.start_date;
      const seasonEnd = season!.end_date;

      const hasStarted = todayStr >= startDate;


      // Slut på perioden: i dag eller sæsonens slutdato (den tidligste)
      const endDate = seasonEnd && seasonEnd < todayStr ? seasonEnd : todayStr;

      const periodStart = `${startDate}T00:00:00+00:00`;
      const periodEnd = `${endDate}T23:59:59+00:00`;

      if (!hasStarted) {
        return {
          hasStarted: false,
          periodStart,
          periodEnd,
          teams: [],
          totalTeams: 0,
          totalPlayers: 0,
          countingPlayers: 0,
        };
      }

      // Alle hold + medlemmer
      const { data: members, error: memberError } = await supabase
        .from("team_members")
        .select(
          "employee_id, team:teams(id, name), employee:employee_master_data(id, first_name, last_name)"
        );
      if (memberError) throw memberError;

      const provisionTotal = await fetchProvisionByEmployee(periodStart, periodEnd);

      // Perioden uden i dag (til dagsdelta og pladsændring)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toDateOnly(yesterday);
      const includesToday = endDate === todayStr;
      const beforeEnd = `${yesterdayStr}T23:59:59+00:00`;
      const hasBefore = includesToday && yesterdayStr >= startDate;
      const provisionExclToday = hasBefore
        ? await fetchProvisionByEmployee(periodStart, beforeEnd)
        : includesToday
          ? {}
          : provisionTotal;

      // Grupper pr. hold
      interface RawPlayer extends TeamCompetitionPlayer {
        excl_today: number;
      }
      const teamMap = new Map<string, { name: string; players: RawPlayer[] }>();

      (members || []).forEach((row: any) => {
        const team = row.team;
        const employee = row.employee;
        if (!team?.id || !employee?.id) return;
        if (TEAM_COMPETITION_EXCLUDED_TEAMS.includes(team.name)) return;

        const provision = provisionTotal[employee.id] ?? 0;
        const exclToday = provisionExclToday[employee.id] ?? 0;

        if (!teamMap.has(team.id)) teamMap.set(team.id, { name: team.name, players: [] });
        teamMap.get(team.id)!.players.push({
          employee_id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          provision,
          today_provision: Math.max(0, provision - exclToday),
          excl_today: exclToday,
          counts: false,
        });
      });


      // Totaler nu og uden i dag
      const totalsNow: Array<{ team_id: string; provision: number }> = [];
      const totalsBefore: Array<{ team_id: string; provision: number }> = [];

      const rows: Array<Omit<TeamCompetitionRow, "rank" | "previous_rank" | "rank_change">> = [];

      teamMap.forEach((value, teamId) => {
        const sorted = [...value.players].sort((a, b) => b.provision - a.provision);
        const counting = sorted.slice(0, TEAM_COMPETITION_COUNTING_PLAYERS);
        counting.forEach((p) => {
          p.counts = true;
        });
        const provision = counting.reduce((sum, p) => sum + p.provision, 0);
        const todayProvision = counting.reduce((sum, p) => sum + p.today_provision, 0);

        // Top 5 målt uden i dag (til pladsændring)
        const beforeTop = [...value.players]
          .map((p) => p.excl_today)
          .sort((a, b) => b - a)
          .slice(0, TEAM_COMPETITION_COUNTING_PLAYERS)
          .reduce((sum, v) => sum + v, 0);

        totalsNow.push({ team_id: teamId, provision });
        totalsBefore.push({ team_id: teamId, provision: beforeTop });

        rows.push({
          team_id: teamId,
          team_name: value.name,
          provision,
          today_provision: todayProvision,
          players: sorted,
          counting_players: counting,
        });
      });

      const ranksNow = rankTeams(totalsNow);
      const ranksBefore = rankTeams(totalsBefore);

      const teams: TeamCompetitionRow[] = rows
        .map((r) => {
          const rank = ranksNow[r.team_id] ?? 0;
          const previousRank = ranksBefore[r.team_id] ?? rank;
          return { ...r, rank, previous_rank: previousRank, rank_change: previousRank - rank };
        })
        .sort((a, b) => a.rank - b.rank);

      return {
        hasStarted: true,
        periodStart,
        periodEnd,
        teams,
        totalTeams: teams.length,
        totalPlayers: teams.reduce((sum, t) => sum + t.players.length, 0),
        countingPlayers: teams.reduce((sum, t) => sum + t.counting_players.length, 0),
      };
    },
  });
}
