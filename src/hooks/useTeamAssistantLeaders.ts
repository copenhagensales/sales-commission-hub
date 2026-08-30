import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamAssistantLeader {
  team_id: string;
  employee_id: string;
  created_at: string;
  /** Om medarbejderen stadig er aktiv i stamdata (null = medarbejder ikke fundet) */
  is_active: boolean | null;
  employee_name: string | null;
}

/**
 * Alle assisterende teamleder-relationer.
 *
 * Rækkerne indeholder BÅDE aktive og inaktive medarbejdere, fordi
 * team-administrationen skal kunne vise og rydde op i gamle relationer.
 * Beregninger (løn, ATP, DB) skal bruge de aktive helpers nedenfor.
 */
export function useTeamAssistantLeaders() {
  return useQuery({
    queryKey: ["team-assistant-leaders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_assistant_leaders")
        .select(
          "team_id, employee_id, created_at, employee:employee_master_data(is_active, first_name, last_name)"
        );
      if (error) throw error;

      type Row = {
        team_id: string;
        employee_id: string;
        created_at: string;
        employee: { is_active: boolean | null; first_name: string | null; last_name: string | null } | null;
      };

      return ((data ?? []) as unknown as Row[]).map((row) => ({
        team_id: row.team_id,
        employee_id: row.employee_id,
        created_at: row.created_at,
        is_active: row.employee ? row.employee.is_active ?? false : null,
        employee_name: row.employee
          ? `${row.employee.first_name ?? ""} ${row.employee.last_name ?? ""}`.trim()
          : null,
      })) as TeamAssistantLeader[];
    },
  });
}

/**
 * Assistent-ID'er for et team.
 * Som standard returneres ALLE relationer (også inaktive medarbejdere), da
 * administrationen skal kunne se dem. Sæt `activeOnly` i beregninger.
 */
export function getTeamAssistantIds(
  teamAssistants: TeamAssistantLeader[] | undefined,
  teamId: string,
  options?: { activeOnly?: boolean }
): string[] {
  if (!teamAssistants) return [];
  return teamAssistants
    .filter((ta) => ta.team_id === teamId)
    .filter((ta) => (options?.activeOnly ? ta.is_active === true : true))
    .map((ta) => ta.employee_id);
}

/** Kun aktive assistenter på et team — brug denne i løn-/DB-beregninger. */
export function getActiveTeamAssistantIds(
  teamAssistants: TeamAssistantLeader[] | undefined,
  teamId: string
): string[] {
  return getTeamAssistantIds(teamAssistants, teamId, { activeOnly: true });
}

/** Alle unikke assistent-ID'er på tværs af teams. */
export function getAllAssistantIds(
  teamAssistants: TeamAssistantLeader[] | undefined,
  options?: { activeOnly?: boolean }
): string[] {
  if (!teamAssistants) return [];
  return [
    ...new Set(
      teamAssistants
        .filter((ta) => (options?.activeOnly ? ta.is_active === true : true))
        .map((ta) => ta.employee_id)
    ),
  ];
}

/** Kun aktive assistenter på tværs af teams — brug denne i løn-/DB-beregninger. */
export function getAllActiveAssistantIds(
  teamAssistants: TeamAssistantLeader[] | undefined
): string[] {
  return getAllAssistantIds(teamAssistants, { activeOnly: true });
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
      queryClient.invalidateQueries({ queryKey: ["db-data-quality"] });
    },
  });
}
