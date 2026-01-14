import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface KpiFormula {
  id: string;
  name: string;
  description: string | null;
  formula: string;
  base_metric: string | null;
  kpi_type: string;
  created_at: string;
  updated_at: string;
}

export interface CreateKpiFormulaInput {
  name: string;
  description?: string;
  formula: string;
  base_metric?: string;
  kpi_type: string;
}

export function useKpiFormulas() {
  return useQuery({
    queryKey: ["kpi-formulas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_kpis")
        .select("*")
        .not("formula", "is", null)
        .order("name");
      
      if (error) throw error;
      return data as KpiFormula[];
    },
  });
}

export function useKpiFormula(id: string | null) {
  return useQuery({
    queryKey: ["kpi-formula", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("dashboard_kpis")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as KpiFormula;
    },
    enabled: !!id,
  });
}

export function useCreateKpiFormula() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateKpiFormulaInput) => {
      const { data, error } = await supabase
        .from("dashboard_kpis")
        .insert({
          name: input.name,
          description: input.description || null,
          formula: input.formula,
          base_metric: input.base_metric || null,
          kpi_type: input.kpi_type,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-formulas"] });
      toast.success("Formel oprettet");
    },
    onError: (error) => {
      toast.error("Kunne ikke oprette formel: " + error.message);
    },
  });
}

export function useUpdateKpiFormula() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: CreateKpiFormulaInput & { id: string }) => {
      const { data, error } = await supabase
        .from("dashboard_kpis")
        .update({
          name: input.name,
          description: input.description || null,
          formula: input.formula,
          base_metric: input.base_metric || null,
          kpi_type: input.kpi_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["kpi-formulas"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-formula", variables.id] });
      toast.success("Formel opdateret");
    },
    onError: (error) => {
      toast.error("Kunne ikke opdatere formel: " + error.message);
    },
  });
}

export function useDeleteKpiFormula() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dashboard_kpis")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-formulas"] });
      toast.success("Formel slettet");
    },
    onError: (error) => {
      toast.error("Kunne ikke slette formel: " + error.message);
    },
  });
}

export function useUpdateKpiFormulaStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("dashboard_kpis")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-formulas"] });
    },
  });
}

// Available base metrics for formula building
export const BASE_METRICS = [
  { key: "antal_salg", label: "Antal salg", description: "Totalt antal godkendte salg" },
  { key: "antal_kunder", label: "Antal kunder", description: "Unikke kunder" },
  { key: "timer", label: "Timer", description: "Timer fra vagtplan/stemplinger" },
  { key: "antal_medarbejdere", label: "Antal medarbejdere", description: "Unikke sælgere" },
  { key: "commission", label: "Provision", description: "Total provision i DKK" },
  { key: "revenue", label: "Omsætning", description: "Total omsætning i DKK" },
  { key: "antal_opkald", label: "Antal opkald", description: "Totalt antal opkald" },
  { key: "opkaldstid", label: "Opkaldstid", description: "Total opkaldstid i minutter" },
] as const;

export const OPERATORS = [
  { key: "+", label: "+" },
  { key: "-", label: "−" },
  { key: "*", label: "×" },
  { key: "/", label: "÷" },
] as const;

export const KPI_TYPES = [
  { key: "number", label: "Tal" },
  { key: "percentage", label: "Procent" },
  { key: "currency", label: "Valuta (DKK)" },
  { key: "decimal", label: "Decimal" },
] as const;
