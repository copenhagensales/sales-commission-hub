import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useShouldShowPulseSurvey } from "./usePulseSurvey";

export function usePulseSurveyLock() {
  const { user } = useAuth();
  const { activeSurvey, hasCompleted, isLoading: completionLoading, showMenuItem } = useShouldShowPulseSurvey();

  // Strict gate: only run when we KNOW the user has not completed (=== false), not undefined
  const enabled =
    !!activeSurvey?.id &&
    !!user &&
    showMenuItem &&
    !completionLoading &&
    hasCompleted === false;

  const { data, isLoading } = useQuery({
    queryKey: ['pulse-survey-lock', activeSurvey?.id, user?.id],
    queryFn: async () => {
      if (!activeSurvey?.id) return { isLocked: false };

      const { data: dismissalData, error } = await supabase.rpc('get_pulse_survey_dismissal', {
        _survey_id: activeSurvey.id,
      });

      if (error) {
        console.warn('[usePulseSurveyLock] RPC error:', error);
        return { isLocked: false };
      }

      const d = (dismissalData ?? {}) as Record<string, any>;
      if (!d.employeeId || d.isStaff) return { isLocked: false };

      const hasUsedSnooze = (d.dismissalCount ?? 0) >= 1;
      const snoozeExpired = d.dismissedUntil ? new Date(d.dismissedUntil) <= new Date() : true;
      const isLocked = !!(hasUsedSnooze && snoozeExpired);

      return { isLocked };
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });

  // Hard guard: never report locked while completion is loading or completion is true
  if (completionLoading || hasCompleted !== false) {
    if (activeSurvey && user) {
      console.log('[usePulseSurveyLock] gated', {
        surveyId: activeSurvey?.id,
        hasCompleted,
        completionLoading,
      });
    }
    return { isLocked: false, isLoading: completionLoading };
  }

  return {
    isLocked: data?.isLocked ?? false,
    isLoading,
  };
}
