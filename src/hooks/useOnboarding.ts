import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface OnboardingVideo {
  title: string;
  duration_min: number;
}

export interface OnboardingDay {
  id: string;
  day: number;
  week: number;
  focus_id: string;
  focus_title: string;
  focus_description: string | null;
  videos: OnboardingVideo[];
  quiz_questions: number;
  quiz_pass_score: number;
  drill_id: string | null;
  drill_title: string | null;
  drill_duration_min: number | null;
  call_mission: string | null;
  checkout_confidence_scale: boolean;
  checkout_blockers: string[];
  leader_course_title: string | null;
  leader_course_duration_min: number | null;
  leader_course_ppt_id: string | null;
  coaching_required: boolean;
  coaching_focus_only: boolean;
  coaching_reviews_per_rep: number;
  created_at: string;
  updated_at: string;
}

export interface OnboardingDrill {
  id: string;
  title: string;
  focus: string;
  description: string | null;
  duration_min: number;
  created_at: string;
}

export interface EmployeeProgress {
  id: string;
  employee_id: string;
  onboarding_day_id: string;
  videos_completed: string[];
  quiz_completed: boolean;
  quiz_score: number | null;
  drill_completed: boolean;
  checkout_completed: boolean;
  checkout_confidence: number | null;
  checkout_blockers: string[] | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachingTask {
  id: string;
  employee_id: string;
  leader_id: string | null;
  onboarding_day_id: string;
  call_id: string | null;
  call_timestamp: string | null;
  score: number | null;
  strength: string | null;
  improvement: string | null;
  suggested_phrase: string | null;
  assigned_drill_id: string | null;
  status: "open" | "done" | "overdue";
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useOnboardingDays() {
  return useQuery({
    queryKey: ["onboarding-days"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_days")
        .select("*")
        .order("week", { ascending: true })
        .order("day", { ascending: true });

      if (error) throw error;
      
      return (data || []).map(d => ({
        ...d,
        videos: (d.videos as unknown as OnboardingVideo[]) || [],
        checkout_blockers: d.checkout_blockers || [],
      })) as OnboardingDay[];
    },
  });
}

export function useOnboardingDrills() {
  return useQuery({
    queryKey: ["onboarding-drills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_drills")
        .select("*")
        .order("id");

      if (error) throw error;
      return data as OnboardingDrill[];
    },
  });
}

export function useEmployeeOnboardingProgress(employeeId?: string) {
  return useQuery({
    queryKey: ["employee-onboarding-progress", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from("employee_onboarding_progress")
        .select("*")
        .eq("employee_id", employeeId);

      if (error) throw error;
      
      return (data || []).map(p => ({
        ...p,
        videos_completed: (p.videos_completed as unknown as string[]) || [],
      })) as EmployeeProgress[];
    },
    enabled: !!employeeId,
  });
}

export function useCoachingTasks(filters?: { employeeId?: string; leaderId?: string; status?: string }) {
  return useQuery({
    queryKey: ["coaching-tasks", filters],
    queryFn: async () => {
      let query = supabase.from("onboarding_coaching_tasks").select("*");
      
      if (filters?.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }
      if (filters?.leaderId) {
        query = query.eq("leader_id", filters.leaderId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data as CoachingTask[];
    },
  });
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      employeeId: string;
      dayId: string;
      updates: Partial<Omit<EmployeeProgress, "id" | "employee_id" | "onboarding_day_id" | "created_at" | "updated_at">>;
    }) => {
      const { employeeId, dayId, updates } = params;
      
      // Check if progress exists
      const { data: existing } = await supabase
        .from("employee_onboarding_progress")
        .select("id")
        .eq("employee_id", employeeId)
        .eq("onboarding_day_id", dayId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("employee_onboarding_progress")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_onboarding_progress")
          .insert({
            employee_id: employeeId,
            onboarding_day_id: dayId,
            ...updates,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["employee-onboarding-progress", variables.employeeId] });
    },
    onError: (error: any) => {
      toast.error("Kunne ikke opdatere fremskridt");
      console.error(error);
    },
  });
}

export function useCreateCoachingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Omit<CoachingTask, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("onboarding_coaching_tasks")
        .insert(task);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaching-tasks"] });
      toast.success("Coaching opgave oprettet");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke oprette coaching opgave");
      console.error(error);
    },
  });
}

export function useUpdateCoachingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<CoachingTask> }) => {
      const { error } = await supabase
        .from("onboarding_coaching_tasks")
        .update(params.updates)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaching-tasks"] });
      toast.success("Coaching opgave opdateret");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke opdatere coaching opgave");
      console.error(error);
    },
  });
}

export function useCurrentEmployeeId() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["current-employee-id", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${user.email},work_email.ilike.${user.email}`)
        .maybeSingle();
      
      return data?.id || null;
    },
    enabled: !!user?.email,
  });
}
