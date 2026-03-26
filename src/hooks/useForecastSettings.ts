import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ForecastSettings {
  id: string;
  team_id: string;
  client_id: string | null;
  month: number;
  year: number;
  client_goal: number;
  sick_pct: number;
  vacation_pct: number;
  churn_new_pct: number;
  churn_established_pct: number;
  new_seller_weekly_target: number;
  new_seller_threshold: number;
  rolling_avg_shifts: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useForecastSettingsList(month: number, year: number) {
  return useQuery({
    queryKey: ["forecast-settings", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forecast_settings")
        .select("*, teams:team_id(id, name)")
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return data as (ForecastSettings & { teams: { id: string; name: string } })[];
    },
  });
}

export function useForecastSettingsById(id: string | undefined) {
  return useQuery({
    queryKey: ["forecast-settings-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("forecast_settings")
        .select("*, teams:team_id(id, name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as (ForecastSettings & { teams: { id: string; name: string } }) | null;
    },
    enabled: !!id,
  });
}

export function useCreateForecastSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      team_id: string;
      client_id?: string | null;
      month: number;
      year: number;
      client_goal?: number;
      new_seller_weekly_target?: number;
      new_seller_threshold?: number;
      rolling_avg_shifts?: number;
      sick_pct?: number;
      vacation_pct?: number;
      churn_new_pct?: number;
      churn_established_pct?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("forecast_settings")
        .insert({ ...input, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecast-settings"] });
      toast.success("Forecast oprettet");
    },
    onError: (err: any) => {
      if (err?.message?.includes("duplicate")) {
        toast.error("Der findes allerede et forecast for dette team og denne måned");
      } else {
        toast.error("Kunne ikke oprette forecast");
      }
    },
  });
}

export function useUpdateForecastSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ForecastSettings> & { id: string }) => {
      const { data, error } = await supabase
        .from("forecast_settings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["forecast-settings"] });
      queryClient.invalidateQueries({ queryKey: ["forecast-settings-detail", data.id] });
      toast.success("Forecast opdateret");
    },
    onError: () => toast.error("Kunne ikke opdatere forecast"),
  });
}

export function useDeleteForecastSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forecast_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecast-settings"] });
      toast.success("Forecast slettet");
    },
    onError: () => toast.error("Kunne ikke slette forecast"),
  });
}

export function useCopyForecastFromPrevMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ team_id, month, year }: { team_id: string; month: number; year: number }) => {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      
      const { data: prev, error: prevErr } = await supabase
        .from("forecast_settings")
        .select("*")
        .eq("team_id", team_id)
        .eq("month", prevMonth)
        .eq("year", prevYear)
        .maybeSingle();
      
      if (prevErr) throw prevErr;
      if (!prev) throw new Error("Ingen forecast fundet for forrige måned");
      
      const { data: { user } } = await supabase.auth.getUser();
      const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...rest } = prev;
      
      const { data, error } = await supabase
        .from("forecast_settings")
        .insert({ ...rest, month, year, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecast-settings"] });
      toast.success("Indstillinger kopieret fra forrige måned");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Kunne ikke kopiere fra forrige måned");
    },
  });
}
