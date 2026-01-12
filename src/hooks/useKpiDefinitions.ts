import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type KpiCategory = "sales" | "hours" | "calls" | "employees" | "other";

export interface KpiDefinition {
  id: string;
  slug: string;
  name: string;
  category: KpiCategory;
  description: string | null;
  calculation_formula: string | null;
  sql_query: string | null;
  data_sources: string[];
  important_notes: string[];
  example_value: string | null;
  created_at: string;
  updated_at: string;
}

export function useKpiDefinitions(category?: KpiCategory) {
  return useQuery({
    queryKey: ["kpi-definitions", category],
    queryFn: async () => {
      let query = supabase
        .from("kpi_definitions")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as KpiDefinition[];
    },
  });
}

export function useKpiDefinition(id: string | null) {
  return useQuery({
    queryKey: ["kpi-definition", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as KpiDefinition;
    },
    enabled: !!id,
  });
}

export function useCreateKpiDefinition() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<KpiDefinition, "id" | "created_at" | "updated_at">) => {
      const { data: result, error } = await supabase
        .from("kpi_definitions")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      toast({
        title: "KPI oprettet",
        description: "KPI-definitionen er blevet oprettet.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateKpiDefinition() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<KpiDefinition, "id" | "created_at" | "updated_at">>;
    }) => {
      const { data: result, error } = await supabase
        .from("kpi_definitions")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      toast({
        title: "KPI opdateret",
        description: "KPI-definitionen er blevet opdateret.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteKpiDefinition() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kpi_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-definitions"] });
      toast({
        title: "KPI slettet",
        description: "KPI-definitionen er blevet slettet.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
