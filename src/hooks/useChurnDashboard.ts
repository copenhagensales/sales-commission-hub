import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ChurnMetricsPayload } from "@/lib/churn/metrics";

export const CHURN_QUERY_KEYS = {
  metrics: "churn-dashboard-metrics",
  settings: "churn-dashboard-settings",
  actions: "churn-actions",
} as const;

/** Eneste indgang til churn-tal. Al beregning ligger i den centrale RPC. */
export function useChurnMetrics(asOfDate?: string) {
  return useQuery({
    queryKey: [CHURN_QUERY_KEYS.metrics, asOfDate ?? "default"],
    queryFn: async (): Promise<ChurnMetricsPayload> => {
      const { data, error } = await supabase.rpc("get_churn_dashboard_metrics", {
        p_as_of_date: asOfDate ?? undefined,
      });
      if (error) throw error;
      return data as unknown as ChurnMetricsPayload;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface ChurnDashboardSettingsRow {
  id: string;
  official_horizon_days: number;
  official_month_count: number;
  target_60d_rate: number | null;
  minimum_n: number;
  yellow_threshold_pp: number;
  orange_threshold_pp: number;
  material_trend_pp: number;
  benchmark_min_n: number;
  benchmark_min_months: number;
  timezone: string;
}

export function useChurnSettings() {
  return useQuery({
    queryKey: [CHURN_QUERY_KEYS.settings],
    queryFn: async (): Promise<ChurnDashboardSettingsRow | null> => {
      const { data, error } = await supabase
        .from("churn_dashboard_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ChurnDashboardSettingsRow | null;
    },
  });
}

export function useUpdateChurnSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ChurnDashboardSettingsRow> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("churn_dashboard_settings").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHURN_QUERY_KEYS.settings] });
      qc.invalidateQueries({ queryKey: [CHURN_QUERY_KEYS.metrics] });
      toast.success("Indstillinger opdateret");
    },
    onError: (e: Error) => toast.error(`Kunne ikke opdatere indstillinger: ${e.message}`),
  });
}

export interface ChurnActionRow {
  id: string;
  scope_type: string;
  team_key: string | null;
  team_id: string | null;
  leader_id: string | null;
  problem_statement: string;
  hypothesis: string | null;
  action_description: string;
  owner_user_id: string | null;
  owner_name: string | null;
  start_date: string;
  due_date: string | null;
  expected_effect_pp: number | null;
  first_measurable_cohort_month: string | null;
  status: string;
  actual_effect_pp: number | null;
  decision: string;
  created_at: string;
}

export type ChurnActionInput = Omit<ChurnActionRow, "id" | "created_at">;

export function useChurnActions() {
  return useQuery({
    queryKey: [CHURN_QUERY_KEYS.actions],
    queryFn: async (): Promise<ChurnActionRow[]> => {
      const { data, error } = await supabase
        .from("churn_actions")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChurnActionRow[];
    },
  });
}

export function useSaveChurnAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ChurnActionInput> & { id?: string }) => {
      if (input.id) {
        const { id, ...rest } = input;
        const { error } = await supabase.from("churn_actions").update(rest).eq("id", id);
        if (error) throw error;
        return;
      }
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("churn_actions").insert({
        ...(input as ChurnActionInput),
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHURN_QUERY_KEYS.actions] });
      toast.success("Handling gemt");
    },
    onError: (e: Error) => toast.error(`Kunne ikke gemme handling: ${e.message}`),
  });
}

export function useDeleteChurnAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("churn_actions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHURN_QUERY_KEYS.actions] });
      toast.success("Handling slettet");
    },
    onError: (e: Error) => toast.error(`Kunne ikke slette handling: ${e.message}`),
  });
}
