import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for "put this employee on a team".
 *
 * `team_members` is the authoritative team membership everywhere in the system
 * (team overview, RLS `is_in_my_teams`, `last_team_id` sync, automatic client
 * assignments). `employee_master_data.team_id` is only the *planned* team that
 * comes from the onboarding cohort ("Kommende opstarter").
 *
 * This helper writes both, and never moves anyone who already has a team.
 */
export async function ensureTeamMembership(params: {
  employeeId: string;
  /** Team from the onboarding cohort. When null the employee's own team_id is used. */
  teamId?: string | null;
}): Promise<{ assigned: boolean; teamId: string | null }> {
  const { employeeId } = params;

  // Already on a team → never touch it (a manual move must win).
  const { data: existing, error: existingError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("employee_id", employeeId)
    .limit(1);

  if (existingError) {
    console.error("Kunne ikke slå team-medlemskab op:", existingError);
    return { assigned: false, teamId: null };
  }
  if (existing && existing.length > 0) {
    return { assigned: false, teamId: existing[0].team_id };
  }

  let teamId = params.teamId ?? null;

  if (!teamId) {
    // Fallback 1: team planned on the employee row
    const { data: employee } = await supabase
      .from("employee_master_data")
      .select("team_id")
      .eq("id", employeeId)
      .maybeSingle();
    teamId = employee?.team_id ?? null;
  }

  if (!teamId) {
    // Fallback 2: team chosen on the employee's onboarding cohort
    const { data: memberships } = await supabase
      .from("cohort_members")
      .select("cohort:onboarding_cohorts(team_id, start_date)")
      .eq("employee_id", employeeId);

    const cohort = (memberships ?? [])
      .map((row) => (row as { cohort: { team_id: string | null; start_date: string | null } | null }).cohort)
      .filter((c): c is { team_id: string | null; start_date: string | null } => !!c?.team_id)
      .sort((a, b) => ((b.start_date ?? "") > (a.start_date ?? "") ? 1 : -1))[0];

    teamId = cohort?.team_id ?? null;
  }

  if (!teamId) return { assigned: false, teamId: null };

  const { error } = await supabase
    .from("team_members")
    .insert({ employee_id: employeeId, team_id: teamId });

  if (error) {
    // Unique violation = someone else added them in parallel; not an error for us.
    if (!error.message.toLowerCase().includes("duplicate")) {
      console.error("Kunne ikke oprette team-medlemskab:", error);
      return { assigned: false, teamId: null };
    }
  }

  // Keep the planned team on the employee row consistent with reality.
  await supabase
    .from("employee_master_data")
    .update({ team_id: teamId })
    .eq("id", employeeId);

  return { assigned: true, teamId };
}
