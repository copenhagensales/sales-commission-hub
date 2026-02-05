import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamAssistantLeader {
  team_id: string;
  employee_id: string;
  created_at: string;
}

/**
 * Hook to fetch all team assistant leader relationships
 */
export function useTeamAssistantLeaders() {
  return useQuery({
    queryKey: ["team-assistant-leaders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_assistant_leaders")
        .select("team_id, employee_id, created_at");
      if (error) throw error;
      return data as TeamAssistantLeader[];
    },
  });
}

/**
 * Get assistant IDs for a specific team
 */
export function getTeamAssistantIds(
  teamAssistants: TeamAssistantLeader[] | undefined,
  teamId: string
): string[] {
  if (!teamAssistants) return [];
  return teamAssistants
    .filter((ta) => ta.team_id === teamId)
    .map((ta) => ta.employee_id);
}

/**
 * Get all unique assistant IDs across all teams
 */
export function getAllAssistantIds(
  teamAssistants: TeamAssistantLeader[] | undefined
): string[] {
  if (!teamAssistants) return [];
  return [...new Set(teamAssistants.map((ta) => ta.employee_id))];
}

/**
 * Hook to update assistants for a team (replace all)
 */
export function useUpdateTeamAssistants() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ teamId, employeeIds }: { teamId: string; employeeIds: string[] }) => {
      // Delete existing assistants for this team
      const { error: deleteError } = await supabase
        .from("team_assistant_leaders")
        .delete()
        .eq("team_id", teamId);
      if (deleteError) throw deleteError;
      
      // Insert new assistants
      if (employeeIds.length > 0) {
        const { error: insertError } = await supabase
          .from("team_assistant_leaders")
          .insert(employeeIds.map((employee_id) => ({ team_id: teamId, employee_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-assistant-leaders"] });
    },
  });
}
