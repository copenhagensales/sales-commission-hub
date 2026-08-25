import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ChurnMetricsPayload } from "@/lib/churn/metrics";

export const CHURN_QUERY_KEYS = {
  metrics: "churn-dashboard-metrics",
  settings: "churn-dashboard-settings",
  actions: "churn-actions",
  trendWindows: "churn-trend-windows",
} as const;

export interface ChurnTrendWindowsPayload {
  as_of_date: string;
  horizon_days: number;
  window_days: number;
  recent_start: string;
  recent_end: string;
  previous_start: string;
  previous_end: string;
  total: { recent_n: number; recent_x: number; previous_n: number; previous_x: number };
  teams: Array<{
    team_key: string;
    recent_n: number;
    recent_x: number;
    previous_n: number;
    previous_x: number;
  }>;
}

/**
 * Udvikling målt på rullende vinduer i stedet for kalendermåneder.
 * Nyeste vindue slutter (dags dato − horizon), så alle i det har haft fulde horizon-dage.
 */
export function useChurnTrendWindows(windowDays = 30, asOfDate?: string) {
  return useQuery({
    queryKey: [CHURN_QUERY_KEYS.trendWindows, windowDays, asOfDate ?? "default"],
    queryFn: async (): Promise<ChurnTrendWindowsPayload> => {
      const { data, error } = await supabase.rpc("get_churn_trend_windows", {
        p_as_of_date: asOfDate ?? undefined,
        p_window_days: windowDays,
      });
      if (error) throw error;
      return data as unknown as ChurnTrendWindowsPayload;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface Churn30dTrendPayload {
  as_of_date: string;
  horizon_days: number;
  months_requested: number;
  months: Array<{ m: string; starters: number; exits: number }>;
}

/** Udvikling i 30-dages churn pr. startmåned (kun modne måneder). */
export function useChurn30dTrend(months = 6, asOfDate?: string) {
  return useQuery({
    queryKey: ["churn-30d-monthly-trend", months, asOfDate ?? "default"],
    queryFn: async (): Promise<Churn30dTrendPayload> => {
      const { data, error } = await supabase.rpc("get_churn_30d_monthly_trend", {
        p_as_of_date: asOfDate ?? undefined,
        p_months: months,
      });
      if (error) throw error;
      return data as unknown as Churn30dTrendPayload;
    },
    staleTime: 5 * 60 * 1000,
  });
}

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
