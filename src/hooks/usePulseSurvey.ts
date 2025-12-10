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
        .single();

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
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id')
        .eq('private_email', user?.email)
        .single();

      if (!employee) return false;

      const { data, error } = await supabase
        .from('pulse_survey_completions')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('employee_id', employee.id)
        .single();

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
    mutationFn: async ({ surveyId, response }: { 
      surveyId: string; 
      response: PulseSurveyResponse;
    }) => {
      // Get employee data including team
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('id, team_id, team:teams(name)')
        .eq('private_email', user?.email)
        .single();

      // Insert anonymous response with team_id
      const { error: responseError } = await supabase
        .from('pulse_survey_responses')
        .insert({
          survey_id: surveyId,
          team_id: employee?.team_id || null,
          department: (employee?.team as any)?.name || null,
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
