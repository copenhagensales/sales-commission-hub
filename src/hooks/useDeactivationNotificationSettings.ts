import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DeactivationNotificationSettings {
  id: string;
  is_enabled: boolean;
  include_team_leaders: boolean;
  include_assistant_leaders: boolean;
  include_owners: boolean;
  include_recruitment: boolean;
  recipient_job_titles: string[];
  extra_recipients: string[];
  excluded_emails: string[];
  followup_enabled: boolean;
  followup_delay_hours: number;
  followup_exclude_owners: boolean;
  email_subject: string;
  email_body: string;
  updated_at: string;
  updated_by: string | null;
}

export interface DeactivationLogEntry {
  id: string;
  employee_id: string;
  team_id: string | null;
  recipients: string[];
  initial_sent_at: string;
  followup_sent_at: string | null;
  source: string | null;
  subject: string | null;
  status: string;
  error_message: string | null;
  employee_master_data: { first_name: string | null; last_name: string | null } | null;
  teams: { name: string } | null;
}

export const DEACTIVATION_SETTINGS_KEY = ["deactivation-notification-settings"];
export const DEACTIVATION_LOG_KEY = ["deactivation-notification-log"];

export function useDeactivationNotificationSettings() {
  return useQuery({
    queryKey: DEACTIVATION_SETTINGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deactivation_notification_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DeactivationNotificationSettings | null;
    },
  });
}

export function useUpdateDeactivationNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<DeactivationNotificationSettings> & { id: string }) => {
      const { id, ...rest } = updates;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("deactivation_notification_settings")
        .update({ ...rest, updated_by: auth.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEACTIVATION_SETTINGS_KEY });
    },
  });
}

export function useDeactivationNotificationLog(limit = 25) {
  return useQuery({
    queryKey: [...DEACTIVATION_LOG_KEY, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deactivation_reminders_sent")
        .select(
          "id, employee_id, team_id, recipients, initial_sent_at, followup_sent_at, source, subject, status, error_message, employee_master_data(first_name, last_name), teams(name)",
        )
        .order("initial_sent_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as DeactivationLogEntry[];
    },
  });
}

/** Server-side resolution of the recipient list for a given team (owners only). */
export function useDeactivationRecipientPreview(teamId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["deactivation-recipient-preview", teamId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-deactivation-reminder", {
        body: { preview_only: true, team_id: teamId, source: "settings-preview" },
      });
      if (error) throw error;
      return data as { recipients: string[]; subject: string; body: string; team_name: string };
    },
  });
}
