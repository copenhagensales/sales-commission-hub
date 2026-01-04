import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FeedbackType {
  id: string;
  key: string;
  label_da: string;
  sort_order: number;
  is_active: boolean;
}

export interface Objection {
  id: string;
  key: string;
  label_da: string;
  sort_order: number;
  is_active: boolean;
}

export interface CoachingTemplate {
  id: string;
  is_active: boolean;
  type_key: string;
  title: string;
  objection_key: string | null;
  variant: string;
  default_score: number | null;
  strength_default: string;
  next_rep_default: string;
  say_this_default: string | null;
  success_criteria_default: string | null;
  drill_id: string | null;
  reps_default: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CoachingFeedback {
  id: string;
  employee_id: string;
  coach_id: string;
  call_id: string | null;
  template_id: string | null;
  type_key: string;
  objection_key: string | null;
  score: number;
  strength: string;
  next_rep: string;
  say_this: string | null;
  success_criteria: string | null;
  drill_id: string | null;
  reps: number | null;
  evidence: string | null;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export function useFeedbackTypes() {
  return useQuery({
    queryKey: ["coaching-feedback-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaching_feedback_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as FeedbackType[];
    },
  });
}

export function useObjections() {
  return useQuery({
    queryKey: ["coaching-objections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaching_objections")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Objection[];
    },
  });
}

export function useCoachingTemplates(filters?: { typeKey?: string; objectionKey?: string; activeOnly?: boolean }) {
  return useQuery({
    queryKey: ["coaching-templates", filters],
    queryFn: async () => {
      let query = supabase.from("coaching_templates").select("*");
      
      if (filters?.activeOnly !== false) {
        query = query.eq("is_active", true);
      }
      if (filters?.typeKey) {
        query = query.eq("type_key", filters.typeKey);
      }
      if (filters?.objectionKey) {
        query = query.eq("objection_key", filters.objectionKey);
      }
      
      const { data, error } = await query.order("title");
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        tags: (t.tags as string[]) || [],
      })) as CoachingTemplate[];
    },
  });
}

export function useCoachingFeedback(filters?: { employeeId?: string; coachId?: string }) {
  return useQuery({
    queryKey: ["coaching-feedback", filters],
    queryFn: async () => {
      let query = supabase.from("coaching_feedback").select("*");
      
      if (filters?.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }
      if (filters?.coachId) {
        query = query.eq("coach_id", filters.coachId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as CoachingFeedback[];
    },
  });
}

export function useCreateCoachingFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedback: Omit<CoachingFeedback, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("coaching_feedback")
        .insert(feedback)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaching-feedback"] });
      toast.success("Coaching feedback gemt");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke gemme feedback");
      console.error(error);
    },
  });
}

export function useUpdateCoachingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<CoachingTemplate> }) => {
      const { error } = await supabase
        .from("coaching_templates")
        .update(params.updates)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaching-templates"] });
      toast.success("Skabelon opdateret");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke opdatere skabelon");
      console.error(error);
    },
  });
}

export function useCreateCoachingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<CoachingTemplate, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("coaching_templates")
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaching-templates"] });
      toast.success("Skabelon oprettet");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke oprette skabelon");
      console.error(error);
    },
  });
}

export function useDeleteCoachingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coaching_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaching-templates"] });
      toast.success("Skabelon slettet");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke slette skabelon");
      console.error(error);
    },
  });
}
