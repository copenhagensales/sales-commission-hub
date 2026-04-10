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
  one_time_date: string | null;
}

export interface FmChecklistCompletion {
  id: string;
  template_id: string;
  completed_date: string;
  completed_by: string;
  note: string | null;
  created_at: string;
}

export function useFmChecklistTemplates(weekStart?: string, weekEnd?: string) {
  return useQuery({
    queryKey: ["fm-checklist-templates", weekStart, weekEnd],
    queryFn: async () => {
      // Fetch recurring templates
      const { data: recurring, error: err1 } = await supabase
        .from("fm_checklist_templates")
        .select("*")
        .eq("is_active", true)
        .is("one_time_date", null)
        .order("sort_order", { ascending: true });
      if (err1) throw err1;

      // Fetch one-time tasks for this week range
      let oneTime: any[] = [];
      if (weekStart && weekEnd) {
        const { data, error: err2 } = await supabase
          .from("fm_checklist_templates")
          .select("*")
          .eq("is_active", true)
          .not("one_time_date", "is", null)
          .gte("one_time_date", weekStart)
          .lte("one_time_date", weekEnd)
          .order("sort_order", { ascending: true });
        if (err2) throw err2;
        oneTime = data || [];
      }

      return [...(recurring || []), ...oneTime] as FmChecklistTemplate[];
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
      one_time_date,
    }: {
      title: string;
      description?: string;
      weekdays: number[];
      one_time_date?: string;
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
        one_time_date: one_time_date || null,
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

// ── Email config hooks ──

export interface FmChecklistEmailConfig {
  id: string;
  send_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useFmChecklistEmailConfig() {
  return useQuery({
    queryKey: ["fm-checklist-email-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fm_checklist_email_config")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data as FmChecklistEmailConfig;
    },
  });
}

export function useUpdateEmailConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { send_time?: string; is_active?: boolean }) => {
      const { data: existing } = await supabase
        .from("fm_checklist_email_config")
        .select("id")
        .limit(1)
        .single();
      if (!existing) throw new Error("No config row");
      const { error } = await supabase
        .from("fm_checklist_email_config")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fm-checklist-email-config"] });
      toast.success("Email-indstillinger opdateret");
    },
    onError: (error) => {
      toast.error("Kunne ikke opdatere: " + error.message);
    },
  });
}

export interface FmChecklistEmailRecipient {
  id: string;
  email: string;
  created_at: string;
}

export function useFmChecklistEmailRecipients() {
  return useQuery({
    queryKey: ["fm-checklist-email-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fm_checklist_email_recipients")
        .select("*");
      if (error) throw error;
      return data as FmChecklistEmailRecipient[];
    },
  });
}

export function useAddEmailRecipient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from("fm_checklist_email_recipients")
        .insert({ email });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fm-checklist-email-recipients"] });
    },
    onError: (error) => {
      toast.error("Kunne ikke tilføje modtager: " + error.message);
    },
  });
}

export function useRemoveEmailRecipient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipientId: string) => {
      const { error } = await supabase
        .from("fm_checklist_email_recipients")
        .delete()
        .eq("id", recipientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fm-checklist-email-recipients"] });
    },
  });
}
