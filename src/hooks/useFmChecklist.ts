import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface FmChecklistTemplate {
  id: string;
  title: string;
  description: string | null;
  weekdays: number[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface FmChecklistCompletion {
  id: string;
  template_id: string;
  completed_date: string;
  completed_by: string;
  note: string | null;
  created_at: string;
}

export function useFmChecklistTemplates() {
  return useQuery({
    queryKey: ["fm-checklist-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fm_checklist_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as FmChecklistTemplate[];
    },
  });
}

export function useFmChecklistCompletions(weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["fm-checklist-completions", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fm_checklist_completions")
        .select("*")
        .gte("completed_date", weekStart)
        .lte("completed_date", weekEnd);
      if (error) throw error;
      return data as FmChecklistCompletion[];
    },
  });
}

export function useToggleChecklistCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      date,
      completedBy,
      isCompleted,
      completionId,
      note,
    }: {
      templateId: string;
      date: string;
      completedBy: string;
      isCompleted: boolean;
      completionId?: string;
      note?: string;
    }) => {
      if (isCompleted && completionId) {
        // Uncheck - delete completion
        const { error } = await supabase
          .from("fm_checklist_completions")
          .delete()
          .eq("id", completionId);
        if (error) throw error;
      } else {
        // Check - insert completion
        const { error } = await supabase
          .from("fm_checklist_completions")
          .insert({
            template_id: templateId,
            completed_date: date,
            completed_by: completedBy,
            note: note || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fm-checklist-completions"] });
    },
    onError: (error) => {
      toast.error("Kunne ikke opdatere tjekliste: " + error.message);
    },
  });
}

export function useUpdateCompletionNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ completionId, note }: { completionId: string; note: string }) => {
      const { error } = await supabase
        .from("fm_checklist_completions")
        .update({ note })
        .eq("id", completionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fm-checklist-completions"] });
    },
  });
}

export function useAddChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      description,
      weekdays,
    }: {
      title: string;
      description?: string;
      weekdays: number[];
    }) => {
      // Get max sort_order
      const { data: existing } = await supabase
        .from("fm_checklist_templates")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

      const { error } = await supabase.from("fm_checklist_templates").insert({
        title,
        description: description || null,
        weekdays,
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fm-checklist-templates"] });
      toast.success("Opgave tilføjet");
    },
    onError: (error) => {
      toast.error("Kunne ikke tilføje opgave: " + error.message);
    },
  });
}

export function useDeactivateChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("fm_checklist_templates")
        .update({ is_active: false })
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fm-checklist-templates"] });
      toast.success("Opgave fjernet");
    },
  });
}
