import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface LeagueSeasonConfig {
  division_bonus_base?: number;
  division_bonus_step?: number;
  round_end_hour?: number;
  players_per_division?: number;
}

export interface LeagueSeason {
  id: string;
  season_number: number;
  qualification_start_at: string;
  qualification_end_at: string;
  qualification_source_start: string;
  qualification_source_end: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  status: 'draft' | 'qualification' | 'active' | 'completed';
  config: LeagueSeasonConfig | null;
}

export interface LeagueEnrollment {
  id: string;
  employee_id: string;
  season_id: string;
  enrolled_at: string;
  is_active: boolean;
}

export interface QualificationStanding {
  id: string;
  season_id: string;
  employee_id: string;
  current_provision: number;
  deals_count: number;
  projected_division: number;
  projected_rank: number;
  overall_rank: number;
  previous_overall_rank: number | null;
  last_calculated_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    team_name?: string;
  };
}

// Get active season (qualification or active)
export function useActiveSeason() {
  return useQuery({
    queryKey: ["league-active-season"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_seasons")
        .select("*")
        .in("status", ["qualification", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as LeagueSeason | null;
    },
  });
}

// Check if current user is enrolled
export function useMyEnrollment(seasonId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["league-my-enrollment", seasonId, user?.id],
    queryFn: async () => {
      if (!seasonId || !user?.id) return null;
      
      // Get employee_id for current user
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      
      if (!employee) return null;
      
      const { data, error } = await supabase
        .from("league_enrollments")
        .select("*")
        .eq("season_id", seasonId)
        .eq("employee_id", employee.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data as LeagueEnrollment | null;
    },
    enabled: !!seasonId && !!user?.id,
  });
}

// Get qualification standings with employee info
export function useQualificationStandings(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["league-qualification-standings", seasonId],
    queryFn: async () => {
      if (!seasonId) return [];
      
      const { data, error } = await supabase
        .from("league_qualification_standings")
        .select(`
          *,
          employee:employee_master_data!league_qualification_standings_employee_id_fkey(
            id,
            first_name,
            last_name,
            team_id
          )
        `)
        .eq("season_id", seasonId)
        .order("overall_rank", { ascending: true });

      if (error) throw error;
      
      // Fetch team names for all employees via team_members junction
      const employeeIds = (data || [])
        .map(s => s.employee?.id)
        .filter(Boolean) as string[];
      
      let teamMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: teamData } = await supabase
          .from("team_members")
          .select(`
            employee_id,
            team:teams(name)
          `)
          .in("employee_id", employeeIds);
        
        if (teamData) {
          teamData.forEach((tm: any) => {
            if (tm.team?.name) {
              teamMap[tm.employee_id] = tm.team.name;
            }
          });
        }
      }
      
      // Transform data with team_name
      const transformedData = (data || []).map(standing => ({
        ...standing,
        employee: standing.employee ? {
          ...standing.employee,
          team_name: teamMap[standing.employee.id] || null,
        } : undefined,
      }));
      
      return transformedData as QualificationStanding[];
    },
    enabled: !!seasonId,
    refetchInterval: 60000, // Refetch every minute
  });
}

// Get my standing
export function useMyQualificationStanding(seasonId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["league-my-qualification-standing", seasonId, user?.id],
    queryFn: async () => {
      if (!seasonId || !user?.id) return null;
      
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      
      if (!employee) return null;
      
      const { data, error } = await supabase
        .from("league_qualification_standings")
        .select(`
          *,
          employee:employee_master_data!league_qualification_standings_employee_id_fkey(
            id,
            first_name,
            last_name
          )
        `)
        .eq("season_id", seasonId)
        .eq("employee_id", employee.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      
      // Fetch team name via team_members junction
      let teamName: string | null = null;
      if (data?.employee?.id) {
        const { data: teamData } = await supabase
          .from("team_members")
          .select(`team:teams(name)`)
          .eq("employee_id", data.employee.id)
          .maybeSingle();
        
        teamName = (teamData as any)?.team?.name || null;
      }
      
      // Transform data with team_name
      if (data && data.employee) {
        return {
          ...data,
          employee: {
            ...data.employee,
            team_name: teamName,
          },
        } as QualificationStanding;
      }
      
      return data as QualificationStanding | null;
    },
    enabled: !!seasonId && !!user?.id,
  });
}

// Enroll in season
export function useEnrollInSeason() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (seasonId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      // Get employee_id
      const { data: employee, error: empError } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      
      if (empError) throw empError;
      
      // Check if employee is in "Stab" team - they become spectators
      const { data: stabMembership } = await supabase
        .from("team_members")
        .select("team_id, teams!inner(name)")
        .eq("employee_id", employee.id)
        .eq("teams.name", "Stab")
        .maybeSingle();
      
      const isSpectator = !!stabMembership;
      
      // Check if there's an existing inactive enrollment
      const { data: existing } = await supabase
        .from("league_enrollments")
        .select("id, is_active")
        .eq("season_id", seasonId)
        .eq("employee_id", employee.id)
        .maybeSingle();
      
      if (existing) {
        // Re-activate existing enrollment (update spectator status too)
        const { data, error } = await supabase
          .from("league_enrollments")
          .update({ is_active: true, is_spectator: isSpectator })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Create new enrollment
        const { data, error } = await supabase
          .from("league_enrollments")
          .insert({
            season_id: seasonId,
            employee_id: employee.id,
            is_spectator: isSpectator,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, seasonId) => {
      queryClient.invalidateQueries({ queryKey: ["league-my-enrollment", seasonId] });
      queryClient.invalidateQueries({ queryKey: ["league-qualification-standings", seasonId] });
      queryClient.invalidateQueries({ queryKey: ["league-enrollment-count", seasonId] });
    },
  });
}

// Unenroll from a season (soft delete - sets is_active to false)
export function useUnenrollFromSeason() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (seasonId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      // Get employee_id
      const { data: employee, error: empError } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      
      if (empError) throw empError;
      
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("league_enrollments")
        .update({ is_active: false })
        .eq("season_id", seasonId)
        .eq("employee_id", employee.id);

      if (error) throw error;
      
      // Also remove from standings
      await supabase
        .from("league_qualification_standings")
        .delete()
        .eq("season_id", seasonId)
        .eq("employee_id", employee.id);
    },
    onSuccess: (_, seasonId) => {
      queryClient.invalidateQueries({ queryKey: ["league-my-enrollment", seasonId] });
      queryClient.invalidateQueries({ queryKey: ["league-qualification-standings", seasonId] });
      queryClient.invalidateQueries({ queryKey: ["league-enrollment-count", seasonId] });
      queryClient.invalidateQueries({ queryKey: ["league-my-qualification-standing", seasonId] });
    },
  });
}

// Get enrollment count for a season
export function useEnrollmentCount(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["league-enrollment-count", seasonId],
    queryFn: async () => {
      if (!seasonId) return 0;
      
      const { count, error } = await supabase
        .from("league_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("season_id", seasonId)
        .eq("is_active", true);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!seasonId,
  });
}

// Real-time subscription for qualification standings
export function useQualificationStandingsRealtime(
  seasonId: string | undefined,
  onUpdate: () => void
) {
  return useQuery({
    queryKey: ["league-qualification-realtime-setup", seasonId],
    queryFn: async () => {
      if (!seasonId) return null;
      
      const channel = supabase
        .channel(`qualification-standings-${seasonId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "league_qualification_standings",
            filter: `season_id=eq.${seasonId}`,
          },
          () => {
            onUpdate();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
    enabled: !!seasonId,
  });
}

// Update season dates (admin)
export function useUpdateSeasonDates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      seasonId,
      dates,
    }: {
      seasonId: string;
      dates: {
        qualification_source_start?: string;
        qualification_source_end?: string;
        qualification_start_at?: string;
        qualification_end_at?: string;
      };
    }) => {
      const { error } = await supabase
        .from("league_seasons")
        .update(dates)
        .eq("id", seasonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["league-active-season"] });
    },
  });
}
