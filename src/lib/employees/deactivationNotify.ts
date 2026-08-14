import { supabase } from "@/integrations/supabase/client";

export type DeactivationSource =
  | "employee-list"
  | "staff-list"
  | "employee-profile"
  | "employee-form"
  | "manual";

export interface DeactivationNotifyResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  recipientCount?: number;
  recipients?: string[];
}

/**
 * Single source of truth for "an employee was deactivated → notify".
 *
 * Recipients, template and on/off are resolved server-side from
 * `deactivation_notification_settings` — never hardcoded in the UI.
 *
 * Snapshot note: a DB trigger removes `team_members` when `is_active` flips to
 * false, so pass `teamId` when it is known *before* the update. The edge
 * function falls back to `team_id` / `last_team_id` when it is not.
 */
export async function notifyEmployeeDeactivated(params: {
  employeeId: string;
  source: DeactivationSource;
  teamId?: string | null;
}): Promise<DeactivationNotifyResult> {
  const { employeeId, source, teamId } = params;

  const { data, error } = await supabase.functions.invoke("send-deactivation-reminder", {
    body: { employee_id: employeeId, team_id: teamId ?? null, source },
  });

  if (error) {
    console.error("Deaktiveringsmail kunne ikke sendes:", error);
    return { success: false, reason: error.message };
  }

  return (data ?? { success: true }) as DeactivationNotifyResult;
}

/** Reads the team the employee belongs to *before* deactivation removes the row. */
export async function snapshotEmployeeTeamId(employeeId: string): Promise<string | null> {
  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("employee_id", employeeId)
    .limit(1)
    .maybeSingle();
  return data?.team_id ?? null;
}
