import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FlowDailyRow } from "@/lib/trygFlow";

export const TRYG_FLOW_FLAG = "tryg_leveringsstatus";
const FLOW_KEY = ["tryg-flow-status", "daily"] as const;
const FLOW_RECIPIENTS_KEY = ["tryg-flow-status", "recipients"] as const;

/** Daglige antal (modtaget/lukket) pr. kampagne. Kun antal — ingen lead-data. */
export function useTrygFlowDaily(enabled: boolean) {
  return useQuery({
    queryKey: FLOW_KEY,
    enabled,
    queryFn: async (): Promise<FlowDailyRow[]> => {
      const all: FlowDailyRow[] = [];
      for (let from = 0; from < 100_000; from += 1000) {
        const { data, error } = await supabase
          .from("weekly_lead_flow_daily")
          .select("day, account, adversus_campaign_id, kind, agent_reference, status, lead_count")
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDanishHolidayDates() {
  return useQuery({
    queryKey: ["danish-holiday-dates"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("danish_holiday").select("date");
      if (error) throw error;
      return (data ?? []).map((r) => r.date);
    },
    staleTime: 60 * 60 * 1000,
  });
}

type FlowRecipient = { id: string; recipient_email: string; is_active: boolean; flow_status: boolean };

/** Interne modtagere af "Leveringsstatus Tryg" (kun @copenhagensales.dk, håndhævet i databasen). */
export function useTrygFlowRecipients(enabled: boolean) {
  return useQuery({
    queryKey: FLOW_RECIPIENTS_KEY,
    enabled,
    queryFn: async (): Promise<FlowRecipient[]> => {
      const { data, error } = await supabase
        .from("weekly_lead_closure_settings")
        .select("id, recipient_email, is_active, flow_status" as "id, recipient_email, is_active")
        .order("recipient_email");
      if (error) throw error;
      return (data ?? []) as unknown as FlowRecipient[];
    },
  });
}

export function useToggleTrygFlowRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; flowStatus: boolean }) => {
      const { error } = await supabase
        .from("weekly_lead_closure_settings")
        .update({ flow_status: input.flowStatus } as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FLOW_RECIPIENTS_KEY }),
  });
}

/** Henter/genberegner kun leveringsstatus (ugetal, opkald og mail røres ikke). */
export function useRunTrygFlowSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (weeks: number) => {
      const { data, error } = await supabase.functions.invoke("weekly-lead-closure-report", {
        body: { weeks, send_mail: false, flow_only: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FLOW_KEY }),
  });
}
