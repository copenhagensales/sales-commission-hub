import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface LeagueRound {
  id: string;
  season_id: string;
  round_number: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export interface LeagueSeasonStanding {
  id: string;
  season_id: string;
  employee_id: string;
  current_division: number;
  total_points: number;
  total_provision: number;
  rounds_played: number;
  overall_rank: number;
  division_rank: number;
  previous_division: number | null;
  updated_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    team_name?: string;
  };
}

export interface LeagueRoundStanding {
  id: string;
  round_id: string;
  season_id: string;
  employee_id: string;
  division: number;
  rank_in_division: number;
  weekly_provision: number;
  weekly_deals: number;
  points_earned: number;
  cumulative_points: number;
  movement: string;
  created_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    team_name?: string;
  };
}

// Get current/latest round for active season
export function useCurrentRound(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["league-current-round", seasonId],
    staleTime: 60000,
    queryFn: async () => {
      if (!seasonId) return null;
      
      const { data, error } = await supabase
        .from("league_rounds")
        .select("*")
        .eq("season_id", seasonId)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as LeagueRound | null;
    },
    enabled: !!seasonId,
  });
}

// Get season standings with employee info
export function useSeasonStandings(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["league-season-standings", seasonId],
    queryFn: async () => {
      if (!seasonId) return [];
      
      const { data, error } = await supabase
        .from("league_season_standings")
        .select(`
          *,
          employee:employee_master_data!league_season_standings_employee_id_fkey(
            id, first_name, last_name
          )
        `)
        .eq("season_id", seasonId)
        .order("overall_rank", { ascending: true });

      if (error) throw error;
      
      // Fetch team names
      const employeeIds = (data || []).map(s => s.employee?.id).filter(Boolean) as string[];
      let teamMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: teamData } = await supabase
          .from("team_members")
          .select("employee_id, team:teams(name)")
          .in("employee_id", employeeIds);
        if (teamData) {
          teamData.forEach((tm: any) => {
            if (tm.team?.name) teamMap[tm.employee_id] = tm.team.name;
          });
        }
      }

      return (data || []).map(s => ({
        ...s,
        employee: s.employee ? { ...s.employee, team_name: teamMap[s.employee.id] || null } : undefined,
      })) as LeagueSeasonStanding[];
    },
    enabled: !!seasonId,
    refetchInterval: 60000,
  });
}

// Get round standings with employee info
export function useRoundStandings(roundId: string | undefined) {
  return useQuery({
    queryKey: ["league-round-standings", roundId],
    queryFn: async () => {
      if (!roundId) return [];
      
      const { data, error } = await supabase
        .from("league_round_standings")
        .select(`
          *,
          employee:employee_master_data!league_round_standings_employee_id_fkey(
            id, first_name, last_name
          )
        `)
        .eq("round_id", roundId)
        .order("division", { ascending: true })
        .order("rank_in_division", { ascending: true });

      if (error) throw error;

      const employeeIds = (data || []).map(s => s.employee?.id).filter(Boolean) as string[];
      let teamMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: teamData } = await supabase
          .from("team_members")
          .select("employee_id, team:teams(name)")
          .in("employee_id", employeeIds);
        if (teamData) {
          teamData.forEach((tm: any) => {
            if (tm.team?.name) teamMap[tm.employee_id] = tm.team.name;
          });
        }
      }

      return (data || []).map(s => ({
        ...s,
        employee: s.employee ? { ...s.employee, team_name: teamMap[s.employee.id] || null } : undefined,
      })) as LeagueRoundStanding[];
    },
    enabled: !!roundId,
  });
}

// Get all completed rounds for history
export function useRoundHistory(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["league-round-history", seasonId],
    staleTime: 60000,
    queryFn: async () => {
      if (!seasonId) return [];
      
      const { data, error } = await supabase
        .from("league_rounds")
        .select("*")
        .eq("season_id", seasonId)
        .eq("status", "completed")
        .order("round_number", { ascending: false });

      if (error) throw error;
      return data as LeagueRound[];
    },
    enabled: !!seasonId,
  });
}

// Get my season standing
export function useMySeasonStanding(seasonId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["league-my-season-standing", seasonId, user?.id],
    staleTime: 60000,
    queryFn: async () => {
      if (!seasonId || !user?.id) return null;
      
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      
      if (!employee) return null;
      
      const { data, error } = await supabase
        .from("league_season_standings")
        .select("*")
        .eq("season_id", seasonId)
        .eq("employee_id", employee.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data as LeagueSeasonStanding | null;
    },
    enabled: !!seasonId && !!user?.id,
  });
}
