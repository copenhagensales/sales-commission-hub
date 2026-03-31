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
export function useHasCompletedSurvey(surveyId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pulse-survey-completion', surveyId, user?.id],
    queryFn: async () => {
      if (!surveyId) return false;

      // Get current employee ID
      const lowerEmail = user?.email?.toLowerCase() || '';
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id')
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) return false;

      const { data, error } = await supabase
        .from('pulse_survey_completions')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('employee_id', employee.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    },
    enabled: !!surveyId && !!user
  });
}

// Hook to check if user should see pulse survey menu
export function useShouldShowPulseSurvey() {
  const { data: roleData } = useCurrentUserRole();
  const { data: activeSurvey, isLoading: surveyLoading } = useActivePulseSurvey();
  const { data: hasCompleted, isLoading: completionLoading } = useHasCompletedSurvey(activeSurvey?.id);

  // Only show for "medarbejder" role
  const isEmployee = roleData?.role === 'medarbejder';
  const showBadge = isEmployee && !!activeSurvey && !hasCompleted;

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
      // Get employee data for completion tracking
      const lowerEmail = user?.email?.toLowerCase() || '';
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id')
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      // Get team name for the selected team
      let teamName: string | null = null;
      if (selectedTeamId) {
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('id', selectedTeamId)
          .maybeSingle();
        teamName = team?.name || null;
      }

      // Insert anonymous response with user-selected team
      const { error: responseError } = await supabase
        .from('pulse_survey_responses')
        .insert({
          survey_id: surveyId,
          team_id: selectedTeamId || null,
          department: teamName,
          ...response
        });

      if (responseError) throw responseError;

      // Mark as completed
      if (employee) {
        const { error: completionError } = await supabase
          .from('pulse_survey_completions')
          .insert({
            survey_id: surveyId,
            employee_id: employee.id
          });

        if (completionError) throw completionError;
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-survey-completion'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-survey-active'] });
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

      const lowerEmail = user?.email?.toLowerCase() || '';
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id, is_staff_employee')
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) return { isDismissed: false, isStaff: false, employeeId: null };

      const { data } = await supabase
        .from('pulse_survey_dismissals')
        .select('dismissed_until, dismissal_count')
        .eq('survey_id', surveyId)
        .eq('employee_id', employee.id)
        .maybeSingle();

      const isDismissed = data ? new Date(data.dismissed_until) > new Date() : false;
      const dismissalCount = (data as any)?.dismissal_count ?? 0;

      return {
        isDismissed,
        isStaff: employee.is_staff_employee === true,
        employeeId: employee.id,
        dismissalCount,
      };
    },
    enabled: !!surveyId && !!user,
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

      const lowerEmail = user?.email?.toLowerCase() || '';
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id')
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (!employee) return null;

      const { data, error } = await supabase
        .from('pulse_survey_drafts')
        .select('draft_data')
        .eq('survey_id', surveyId)
        .eq('employee_id', employee.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.draft_data as Record<string, unknown> | null;
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
