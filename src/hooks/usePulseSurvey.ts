import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCurrentUserRole } from "./useSystemRoles";

export interface PulseSurveyResponse {
  nps_score: number;
  nps_comment?: string;
  tenure: 'under_1_month' | '1_3_months' | '3_6_months' | 'over_6_months';
  development_score: number;
  leadership_score: number;
  recognition_score: number;
  energy_score: number;
  seriousness_score: number;
  leader_availability_score: number;
  wellbeing_score: number;
  psychological_safety_score: number;
  attrition_risk_score: number;
  product_competitiveness_score: number;
  market_fit_score: number;
  interest_creation_score: number;
  campaign_attractiveness_score: number;
  campaign_improvement_suggestions?: string;
  improvement_suggestions?: string;
}

// Hook to get current active survey
export function useActivePulseSurvey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return useQuery({
    queryKey: ['pulse-survey-active', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pulse_surveys')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });
}

// Hook to check if current user has completed the survey
// Uses RPC `has_completed_pulse_survey` to ensure 100% consistency with edge function & RLS logic
export function useHasCompletedSurvey(surveyId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pulse-survey-completion', surveyId, user?.id],
    queryFn: async () => {
      if (!surveyId) return false;

      const { data, error } = await supabase.rpc('has_completed_pulse_survey', {
        _survey_id: surveyId,
      });

      if (error) {
        console.warn('[useHasCompletedSurvey] RPC error:', error);
        // Fail-safe: if we can't verify, treat as completed to avoid showing the popup in a loop
        return true;
      }

      console.log('[useHasCompletedSurvey] survey:', surveyId, 'completed:', data);
      return !!data;
    },
    enabled: !!surveyId && !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// Hook to check if user should see pulse survey menu
export function useShouldShowPulseSurvey() {
  const { data: roleData } = useCurrentUserRole();
  const { data: activeSurvey, isLoading: surveyLoading } = useActivePulseSurvey();
  const { data: hasCompleted, isLoading: completionLoading } = useHasCompletedSurvey(activeSurvey?.id);

  // Only show for "medarbejder" role
  const isEmployee = roleData?.role === 'medarbejder';
  // Only show badge if we are SURE the user hasn't completed (don't show during loading)
  const showBadge = isEmployee && !!activeSurvey && hasCompleted === false && !completionLoading;

  if (isEmployee && activeSurvey) {
    console.log('[useShouldShowPulseSurvey]', {
      surveyId: activeSurvey.id,
      hasCompleted,
      completionLoading,
      showBadge,
    });
  }

  return {
    showMenuItem: isEmployee,
    showBadge,
    isLoading: surveyLoading || completionLoading,
    activeSurvey,
    hasCompleted
  };
}

// Hook to submit survey response
export function useSubmitPulseSurvey() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ surveyId, selectedTeamId, response }: { 
      surveyId: string; 
      selectedTeamId: string;
      response: PulseSurveyResponse;
    }) => {
      if (!selectedTeamId) {
        throw new Error('Team selection is required');
      }

      // Atomic submission via edge function (response + completion + draft delete)
      const { data, error } = await supabase.functions.invoke('submit-employee-pulse-survey', {
        body: {
          survey_id: surveyId,
          selected_team_id: selectedTeamId,
          ...response,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return { success: true, surveyId };
    },
    onSuccess: async (_data, variables) => {
      // Optimistically mark as completed so popup disappears immediately
      queryClient.setQueryData(
        ['pulse-survey-completion', variables.surveyId, user?.id],
        true
      );
      // Invalidate ALL pulse-survey related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pulse-survey-completion'] }),
        queryClient.invalidateQueries({ queryKey: ['pulse-survey-active'] }),
        queryClient.invalidateQueries({ queryKey: ['pulse-survey-lock'] }),
        queryClient.invalidateQueries({ queryKey: ['pulse-survey-dismissal'] }),
        queryClient.invalidateQueries({ queryKey: ['pulse-survey-draft'] }),
        queryClient.invalidateQueries({ queryKey: ['pulse-survey-has-draft'] }),
      ]);
      // Force refetch of completion to confirm server state
      await queryClient.refetchQueries({ queryKey: ['pulse-survey-completion'] });
    }
  });
}

// Hook for admin to get all surveys
export function useAllPulseSurveys() {
  return useQuery({
    queryKey: ['pulse-surveys-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pulse_surveys')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      return data;
    }
  });
}

// Hook for admin to get survey results
export function usePulseSurveyResults(surveyId?: string) {
  return useQuery({
    queryKey: ['pulse-survey-results', surveyId],
    queryFn: async () => {
      if (!surveyId) return null;

      const { data, error } = await supabase
        .from('pulse_survey_responses')
        .select('*')
        .eq('survey_id', surveyId);

      if (error) throw error;
      return data;
    },
    enabled: !!surveyId
  });
}

// Hook to check if user has dismissed/snoozed the survey
export function usePulseSurveyDismissal(surveyId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pulse-survey-dismissal', surveyId, user?.id],
    queryFn: async () => {
      if (!surveyId) return null;

      const { data, error } = await supabase.rpc('get_pulse_survey_dismissal', {
        _survey_id: surveyId,
      });

      if (error) {
        console.warn('[usePulseSurveyDismissal] RPC error:', error);
        return { isDismissed: false, isStaff: false, employeeId: null, dismissalCount: 0 };
      }

      const d = (data ?? {}) as Record<string, any>;
      return {
        isDismissed: !!d.isDismissed,
        isStaff: !!d.isStaff,
        employeeId: d.employeeId ?? null,
        dismissalCount: d.dismissalCount ?? 0,
      };
    },
    enabled: !!surveyId && !!user,
    staleTime: 0,
  });
}

// Hook to dismiss/snooze a survey for 24 hours
export function useDismissPulseSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId, employeeId }: { surveyId: string; employeeId: string }) => {
      const dismissedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // First get current count
      const { data: existing } = await supabase
        .from('pulse_survey_dismissals')
        .select('dismissal_count')
        .eq('survey_id', surveyId)
        .eq('employee_id', employeeId)
        .maybeSingle();

      const newCount = ((existing as any)?.dismissal_count ?? 0) + 1;

      const { error } = await supabase
        .from('pulse_survey_dismissals')
        .upsert(
          { survey_id: surveyId, employee_id: employeeId, dismissed_until: dismissedUntil, dismissal_count: newCount } as any,
          { onConflict: 'survey_id,employee_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-survey-dismissal'] });
    },
  });
}

// Hook to load a draft for the current user
export function usePulseSurveyDraft(surveyId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pulse-survey-draft', surveyId, user?.id],
    queryFn: async () => {
      if (!surveyId) return null;

      const { data, error } = await supabase.rpc('get_pulse_survey_draft', {
        _survey_id: surveyId,
      });

      if (error) {
        console.warn('[usePulseSurveyDraft] RPC error:', error);
        return null;
      }

      return (data ?? null) as Record<string, unknown> | null;
    },
    enabled: !!surveyId && !!user,
  });
}

// Hook to save/upsert a draft
export function useSavePulseSurveyDraft() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ surveyId, draftData }: { surveyId: string; draftData: Record<string, unknown> }) => {
      const lowerEmail = user?.email?.toLowerCase() || '';
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id')
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) throw new Error('Employee not found');

      const { error } = await supabase
        .from('pulse_survey_drafts')
        .upsert(
          {
            survey_id: surveyId,
            employee_id: employee.id,
            draft_data: draftData as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'survey_id,employee_id' }
        );

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pulse-survey-draft', variables.surveyId] });
    },
  });
}

// Hook to delete a draft after submission
export function useDeletePulseSurveyDraft() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (surveyId: string) => {
      const lowerEmail = user?.email?.toLowerCase() || '';
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id')
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) return;

      const { error } = await supabase
        .from('pulse_survey_drafts')
        .delete()
        .eq('survey_id', surveyId)
        .eq('employee_id', employee.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-survey-draft'] });
    },
  });
}

// Hook to manually activate a survey (for testing or admin)
export function useActivatePulseSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const { data, error } = await supabase
        .from('pulse_surveys')
        .insert({
          year,
          month,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-surveys-all'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-survey-active'] });
    }
  });
}

// Hook to check if current user has a saved draft
export function usePulseSurveyHasDraft(surveyId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pulse-survey-has-draft', surveyId, user?.id],
    queryFn: async () => {
      if (!surveyId) return false;

      const lowerEmail = user?.email?.toLowerCase() || '';
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id')
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) return false;

      const { data } = await supabase
        .from('pulse_survey_drafts')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('employee_id', employee.id)
        .maybeSingle();

      return !!data;
    },
    enabled: !!surveyId && !!user,
  });
}
