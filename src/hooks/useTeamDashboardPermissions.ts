import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnifiedPermissions, usePagePermissions } from "@/hooks/useUnifiedPermissions";
import { useTeamAssistantLeaders } from "@/hooks/useTeamAssistantLeaders";
import { DASHBOARD_LIST, type DashboardConfig } from "@/config/dashboards";

export type DashboardAccessLevel = 'none' | 'team_leader' | 'leadership' | 'all';

export interface TeamDashboardPermission {
  id: string;
  team_id: string;
  dashboard_slug: string;
  access_level: DashboardAccessLevel;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
  team_leader_id: string | null;
}

// Access level labels for UI
export const accessLevelLabels: Record<DashboardAccessLevel, string> = {
  none: "Ingen adgang",
  team_leader: "Kun teamleder",
  leadership: "Ledelse (TL + ATL)",
  all: "Hele teamet",
};

// Hent alle team-dashboard rettigheder (til admin UI)
export function useTeamDashboardPermissions() {
  return useQuery({
    queryKey: ["team-dashboard-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_dashboard_permissions")
        .select("*")
        .order("dashboard_slug");
      
      if (error) throw error;
      return data as TeamDashboardPermission[];
    },
  });
}

// Hent alle teams med deres ledere
export function useTeamsWithLeaders() {
  return useQuery({
    queryKey: ["teams-with-leaders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, team_leader_id")
        .order("name");
      
      if (error) throw error;
      return data as Team[];
    },
  });
}

// Opdater en team-dashboard permission
export function useUpdateTeamDashboardPermission() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      teamId, 
      dashboardSlug, 
      accessLevel 
    }: { 
      teamId: string; 
      dashboardSlug: string; 
      accessLevel: DashboardAccessLevel;
    }) => {
      // Upsert - indsæt eller opdater
      const { error } = await supabase
        .from("team_dashboard_permissions")
        .upsert({
          team_id: teamId,
          dashboard_slug: dashboardSlug,
          access_level: accessLevel,
        }, {
          onConflict: 'team_id,dashboard_slug'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["team-dashboard-permissions"],
        refetchType: 'all' 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["accessible-dashboards"],
        refetchType: 'all'
      });
    },
  });
}

// Auto-seed manglende dashboard permissions
export function useSeedMissingDashboardPermissions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      teams, 
      existingPermissions 
    }: { 
      teams: Team[]; 
      existingPermissions: TeamDashboardPermission[];
    }) => {
      // Build a set of existing combinations
      const existingCombos = new Set(
        existingPermissions.map(p => `${p.team_id}:${p.dashboard_slug}`)
      );
      
      // Find missing combinations
      const missingPermissions: { team_id: string; dashboard_slug: string; access_level: DashboardAccessLevel }[] = [];
      
      for (const team of teams) {
        for (const dashboard of DASHBOARD_LIST) {
          const combo = `${team.id}:${dashboard.slug}`;
          if (!existingCombos.has(combo)) {
            missingPermissions.push({
              team_id: team.id,
              dashboard_slug: dashboard.slug,
              access_level: 'none',
            });
          }
        }
      }
      
      if (missingPermissions.length === 0) return 0;
      
      // Insert in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < missingPermissions.length; i += BATCH_SIZE) {
        const batch = missingPermissions.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("team_dashboard_permissions")
          .upsert(batch, { onConflict: 'team_id,dashboard_slug', ignoreDuplicates: true });
        
        if (error) throw error;
      }
      
      return missingPermissions.length;
    },
    onSuccess: (count) => {
      if (count > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ["team-dashboard-permissions"],
          refetchType: 'all' 
        });
      }
    },
  });
}

// Hent brugerens tilgængelige dashboards
export function useAccessibleDashboards() {
  const { user } = useAuth();
  const { isOwner, isReady, role } = useUnifiedPermissions();
  const { data: assistantRelations } = useTeamAssistantLeaders();
  const { data: rolePermissions } = usePagePermissions();
  
  return useQuery({
    queryKey: ["accessible-dashboards", user?.id, isOwner, role, rolePermissions?.length ?? 0],
    queryFn: async () => {
      // HARDKODET: Ejere har altid fuld adgang til alle dashboards
      if (isOwner) {
        console.log('[useAccessibleDashboards] owner=true, returning all', DASHBOARD_LIST.length);
        return DASHBOARD_LIST;
      }
      
      if (!user?.id) return [];
      
      // 1. Hent employee_id for nuværende bruger
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (!employee?.id) return [];
      const employeeId = employee.id;
      
      // 2. Hent brugerens team-medlemskaber
      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("employee_id", employeeId);
      
      const memberTeamIds = new Set((memberships || []).map(m => m.team_id));
      
      // 3. Hent teams hvor bruger er teamleder
      const { data: leaderTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("team_leader_id", employeeId);
      
      const leaderTeamIds = new Set((leaderTeams || []).map(t => t.id));
      
      // 4. Find teams hvor bruger er assisterende (fra useTeamAssistantLeaders)
      const assistantTeamIds = new Set(
        (assistantRelations || [])
          .filter(a => a.employee_id === employeeId)
          .map(a => a.team_id)
      );
      
      // 5. Hent alle team dashboard permissions
      const { data: permissions } = await supabase
        .from("team_dashboard_permissions")
        .select("*");
      
      const permissionMap = new Map<string, TeamDashboardPermission[]>();
      (permissions || []).forEach(p => {
        const existing = permissionMap.get(p.dashboard_slug) || [];
        existing.push(p as TeamDashboardPermission);
        permissionMap.set(p.dashboard_slug, existing);
      });
      
      // 6. Filtrer dashboards baseret på rettigheder
      const accessibleDashboards = DASHBOARD_LIST.filter(dashboard => {
        // Global dashboards er synlige for alle autentificerede brugere
        if (dashboard.globalAccess) return true;
        
        // Rolle-baseret adgang: tjek om brugerens rolle har can_view for dashboardets permissionKey
        if (dashboard.permissionKey && rolePermissions) {
          const rolePerm = rolePermissions.find(
            p => p.role_key === role && p.permission_key === dashboard.permissionKey
          );
          if (rolePerm?.can_view) return true;
        }
        
        const dashboardPerms = permissionMap.get(dashboard.slug) || [];
        
        // Tjek hver af brugerens teams
        for (const perm of dashboardPerms) {
          // Er bruger medlem af dette team?
          const isMember = memberTeamIds.has(perm.team_id);
          const isLeader = leaderTeamIds.has(perm.team_id);
          const isAssistant = assistantTeamIds.has(perm.team_id);
          
          if (!isMember && !isLeader && !isAssistant) continue;
          
          switch (perm.access_level) {
            case 'all':
              // Alle medlemmer har adgang
              if (isMember || isLeader || isAssistant) return true;
              break;
            case 'leadership':
              // Kun teamleder + assisterende
              if (isLeader || isAssistant) return true;
              break;
            case 'team_leader':
              // Kun teamleder
              if (isLeader) return true;
              break;
            case 'none':
            default:
              // Ingen adgang
              break;
          }
        }
        
        return false;
      });
      
      return accessibleDashboards;
    },
    enabled: !!user && isReady,
    staleTime: 30 * 1000, // 30 sekunder
    refetchOnMount: true,
  });
}

// Check om bruger kan se et specifikt dashboard
export function useCanViewDashboard(dashboardSlug: string): { canView: boolean; isLoading: boolean } {
  const { data: accessibleDashboards = [], isLoading } = useAccessibleDashboards();
  const { isOwner, isReady } = useUnifiedPermissions();
  
  // Ikke klar endnu - vent på at permissions er loaded
  if (!isReady || isLoading) {
    return { canView: false, isLoading: true };
  }
  
  // HARDKODET: Ejere har altid fuld adgang
  if (isOwner) {
    return { canView: true, isLoading: false };
  }
  
  const canView = accessibleDashboards.some(d => d.slug === dashboardSlug);
  return { canView, isLoading: false };
}
