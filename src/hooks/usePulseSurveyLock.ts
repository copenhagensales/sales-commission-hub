import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useShouldShowPulseSurvey } from "./usePulseSurvey";

export function usePulseSurveyLock() {
  const { user } = useAuth();
  const { activeSurvey, hasCompleted, showMenuItem } = useShouldShowPulseSurvey();

  const { data, isLoading } = useQuery({
    queryKey: ['pulse-survey-lock', activeSurvey?.id, user?.id],
    queryFn: async () => {
      if (!activeSurvey?.id) return { isLocked: false };

      const lowerEmail = user?.email?.toLowerCase() || '';
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id, is_staff_employee')
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee || employee.is_staff_employee) return { isLocked: false };

      const { data: dismissal } = await supabase
        .from('pulse_survey_dismissals')
        .select('dismissal_count, dismissed_until')
        .eq('survey_id', activeSurvey.id)
        .eq('employee_id', employee.id)
        .maybeSingle();

      // Lock if they've used their one snooze and the snooze period has expired
      const hasUsedSnooze = dismissal && (dismissal as any).dismissal_count >= 1;
      const snoozeExpired = dismissal ? new Date(dismissal.dismissed_until) <= new Date() : false;
      const isLocked = !!(hasUsedSnooze && snoozeExpired);

      return { isLocked };
    },
    enabled: !!activeSurvey?.id && !!user && showMenuItem && !hasCompleted,
  });

  return {
    isLocked: data?.isLocked ?? false,
    isLoading,
  };
}
