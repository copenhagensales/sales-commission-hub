import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LeagueSeason } from "./useLeagueData";

/** Hold der ikke deltager i holdkonkurrencen (ikke sælgere) */
export const TEAM_COMPETITION_EXCLUDED_TEAMS = ["Stab"];

/**
 * Hold der i holdkonkurrencen slås sammen til ét hold.
 * Alt Fieldmarketing tæller under "Fieldmarketing" — kun her, ikke i data.
 */
export const TEAM_COMPETITION_TEAM_ALIASES: Record<string, string> = {
  "YouSee FM": "Fieldmarketing",
  "Yousee FM": "Fieldmarketing",
  "Eesy FM": "Fieldmarketing",
};

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


/**
 * Provision pr. hold+medarbejder, hvor kun salg på klienter tilknyttet
 * medarbejderens eget hold (team_clients) tælles med.
 * Nøgle i map: `${team_id}|${employee_id}`
 */
async function fetchTeamScopedProvision(
  start: string,
  end: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("get_league_team_provision", {
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  const map: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    if (row.team_id && row.employee_id) {
      map[`${row.team_id}|${row.employee_id}`] = Number(row.total_commission) || 0;
    }
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

      // Alle hold + medlemmer. employee_team_attribution daekker baade aktive
      // teammedlemsskaber og fratraadte medarbejderes sidste kendte team, saa en
      // saelger der stopper midt i sæsonen bevarer sit bidrag til holdet.
      const { data: attribution, error: memberError } = await supabase
        .from("employee_team_attribution")
        .select("employee_id, team_id, team_name");
      if (memberError) throw memberError;

      const attributionIds = Array.from(
        new Set((attribution ?? []).map((row) => row.employee_id).filter((id): id is string => !!id)),
      );
      const { data: attributionEmployees, error: employeeError } = attributionIds.length
        ? await supabase
            .from("employee_master_data")
            .select("id, first_name, last_name")
            .in("id", attributionIds)
        : { data: [], error: null };
      if (employeeError) throw employeeError;

      const employeeById = new Map(
        (attributionEmployees ?? []).map((e) => [e.id, e]),
      );
      const members = (attribution ?? []).map((row) => ({
        employee_id: row.employee_id,
        team: row.team_id ? { id: row.team_id, name: row.team_name } : null,
        employee: row.employee_id ? employeeById.get(row.employee_id) ?? null : null,
      }));

      const provisionTotal = await fetchTeamScopedProvision(periodStart, periodEnd);

      // Perioden uden i dag (til dagsdelta og pladsændring)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toDateOnly(yesterday);
      const includesToday = endDate === todayStr;
      const beforeEnd = `${yesterdayStr}T23:59:59+00:00`;
      const hasBefore = includesToday && yesterdayStr >= startDate;
      const provisionExclToday = hasBefore
        ? await fetchTeamScopedProvision(periodStart, beforeEnd)
        : includesToday
          ? {}
          : provisionTotal;

      // Grupper pr. hold
      interface RawPlayer extends TeamCompetitionPlayer {
        excl_today: number;
      }
      const teamMap = new Map<string, { name: string; players: RawPlayer[] }>();

      // Slå alias-hold sammen: find id på det hold de skal tælle under
      const idByName = new Map<string, string>();
      (members || []).forEach((row: any) => {
        if (row.team?.id && row.team?.name && !idByName.has(row.team.name)) {
          idByName.set(row.team.name, row.team.id);
        }
      });

      const seen = new Set<string>();

      (members || []).forEach((row: any) => {
        const team = row.team;
        const employee = row.employee;
        if (!team?.id || !employee?.id) return;
        if (TEAM_COMPETITION_EXCLUDED_TEAMS.includes(team.name)) return;

        // Alias: fx "YouSee FM" tæller under "Fieldmarketing"
        const aliasName = TEAM_COMPETITION_TEAM_ALIASES[team.name];
        const aliasId = aliasName ? idByName.get(aliasName) : undefined;
        const effectiveTeamId = aliasId || team.id;
        const effectiveTeamName = aliasId ? aliasName! : team.name;

        // Undgå dubletter (samme person kan have flere medlemsrækker)
        const dedupeKey = `${effectiveTeamId}|${employee.id}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        // Provision slås op på både alias-holdet og medarbejderens eget hold
        const keys = [`${effectiveTeamId}|${employee.id}`, `${team.id}|${employee.id}`];
        const provision = Math.max(...keys.map((k) => provisionTotal[k] ?? 0));
        const exclToday = Math.max(...keys.map((k) => provisionExclToday[k] ?? 0));

        if (!teamMap.has(effectiveTeamId)) {
          teamMap.set(effectiveTeamId, { name: effectiveTeamName, players: [] });
        }
        teamMap.get(effectiveTeamId)!.players.push({
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
