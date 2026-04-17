import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CodeOfConductReminder {
  id: string;
  employee_id: string;
  created_at: string;
  snoozed_until: string | null;
  snooze_count: number;
  acknowledged_at: string | null;
}

/**
 * Fetches the active (un-acknowledged) reminder for the current user, if any.
 * Also returns whether the snooze window has expired (→ should trigger lock).
 */
export function useCodeOfConductReminder() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["code-of-conduct-reminder", user?.id],
    queryFn: async () => {
      if (!user?.email) return null;

      const lowerEmail = user.email.toLowerCase();
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) return null;

      const { data, error } = await supabase
        .from("code_of_conduct_reminders")
        .select("*")
        .eq("employee_id", employee.id)
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

  // Should we show the popup right now?
  // Yes if: reminder exists, not acknowledged, and snooze (if any) has not expired
  const shouldShowPopup = !!reminder && (
    !reminder.snoozed_until || new Date(reminder.snoozed_until).getTime() > now
  );

  // Has the snooze window expired? Then we should lock.
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
