import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CocVariant } from "@/hooks/useCodeOfConduct";

export interface CodeOfConductReminder {
  id: string;
  employee_id: string;
  created_at: string;
  snoozed_until: string | null;
  snooze_count: number;
  acknowledged_at: string | null;
  quiz_variant: CocVariant;
}

/**
 * Fetches the active (un-acknowledged) reminder for the current user, if any.
 */
export function useCodeOfConductReminder(variant: CocVariant = "salgskonsulent") {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["code-of-conduct-reminder", user?.id, variant],
    queryFn: async () => {
      if (!user?.email) return null;

      const { data: hasValid } = await supabase.rpc("has_valid_code_of_conduct_completion", {
        _variant: variant,
      } as any);
      if (hasValid === true) return null;

      const lowerEmail = user.email.toLowerCase();
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`);

      const employeeIds = (employees ?? []).map((e) => e.id);
      if (employeeIds.length === 0) return null;

      const { data, error } = await supabase
        .from("code_of_conduct_reminders")
        .select("*")
        .in("employee_id", employeeIds)
        .eq("quiz_variant", variant)
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching reminder:", error);
        return null;
      }

      return data as CodeOfConductReminder | null;
    },
    enabled: !!user?.email,
    refetchInterval: 60000,
  });

  const reminder = query.data;
  const now = Date.now();

  const shouldShowPopup = !!reminder && (
    !reminder.snoozed_until || new Date(reminder.snoozed_until).getTime() > now
  );

  const snoozeExpired = !!reminder && !!reminder.snoozed_until &&
    new Date(reminder.snoozed_until).getTime() <= now;

  return {
    reminder,
    shouldShowPopup,
    snoozeExpired,
    canSnooze: !!reminder && reminder.snooze_count === 0,
    isLoading: query.isLoading,
  };
}

export function useSnoozeCodeOfConductReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("code_of_conduct_reminders")
        .update({
          snoozed_until: snoozedUntil,
          snooze_count: 1,
        })
        .eq("id", reminderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-reminder"] });
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-lock"] });
    },
  });
}

export function useAcknowledgeCodeOfConductReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from("code_of_conduct_reminders")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", reminderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-reminder"] });
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-lock"] });
    },
  });
}
