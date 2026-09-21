import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ReportLineRow = Database["public"]["Tables"]["weekly_lead_report_lines"]["Row"];
export type CampaignMapRow = Database["public"]["Tables"]["weekly_lead_report_campaign_map"]["Row"];
export type ClosingStatusRow = Database["public"]["Tables"]["lead_closing_statuses"]["Row"];
export type ClosureStatRow = Database["public"]["Tables"]["weekly_lead_closure_stats"]["Row"];
export type ClosureRunRow = Database["public"]["Tables"]["weekly_lead_closure_runs"]["Row"];

const MAPPING_KEY = ["weekly-lead-closure", "campaign-map"] as const;
const STATS_KEY = ["weekly-lead-closure", "stats"] as const;

export function useWeeklyLeadReportLines() {
  return useQuery({
    queryKey: ["weekly-lead-closure", "lines"],
    queryFn: async (): Promise<ReportLineRow[]> => {
      const { data, error } = await supabase
        .from("weekly_lead_report_lines")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWeeklyLeadCampaignMap() {
  return useQuery({
    queryKey: MAPPING_KEY,
    queryFn: async (): Promise<CampaignMapRow[]> => {
      const { data, error } = await supabase
        .from("weekly_lead_report_campaign_map")
        .select("*")
        .order("account")
        .order("adversus_campaign_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLeadClosingStatuses() {
  return useQuery({
    queryKey: ["weekly-lead-closure", "statuses"],
    queryFn: async (): Promise<ClosingStatusRow[]> => {
      const { data, error } = await supabase
        .from("lead_closing_statuses")
        .select("*")
        .order("status");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWeeklyLeadClosureStats() {
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: async (): Promise<ClosureStatRow[]> => {
      const { data, error } = await supabase
        .from("weekly_lead_closure_stats")
        .select("*")
        .order("week_start", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWeeklyLeadClosureRuns() {
  return useQuery({
    queryKey: ["weekly-lead-closure", "runs"],
    queryFn: async (): Promise<ClosureRunRow[]> => {
      const { data, error } = await supabase
        .from("weekly_lead_closure_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateCampaignMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; reportLine: string | null; confirm?: boolean }) => {
      const patch: Partial<CampaignMapRow> = { report_line: input.reportLine };
      if (input.confirm !== undefined) {
        patch.is_confirmed = input.confirm;
        patch.confirmed_at = input.confirm ? new Date().toISOString() : null;
      }
      const { error } = await supabase
        .from("weekly_lead_report_campaign_map")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}

/**
 * Starter kørslen og vender tilbage med det samme. Selve arbejdet ligger i en
 * jobkø (ét kald pr. kampagne), så kørslen fortsætter i baggrunden og logges i
 * weekly_lead_closure_runs.
 */
export function useRunWeeklyLeadClosureReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { weeks: number; sendMail: boolean }) => {
      const { data, error } = await supabase.functions.invoke("weekly-lead-closure-report", {
        body: { weeks: input.weeks, send_mail: input.sendMail },
      });
      if (error) throw error;
      return data as { stage?: string; runId?: string; weeks: string[]; jobs?: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: ["weekly-lead-closure", "runs"] });
    },
  });
}

/**
 * Sender mandagsmailen med tallene for den igangværende uge til alle aktive
 * modtagere. Kørslen henter først ugens tal og lægger derefter mailen i køen.
 */
export function useSendWeeklyLeadClosureMailNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("weekly-lead-closure-report", {
        body: { current_week: true, send_mail: true, force_mail: true },
      });
      if (error) throw error;
      return data as { stage?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: ["weekly-lead-closure", "runs"] });
    },
  });
}

export type ClosureRecipientRow =
  Database["public"]["Tables"]["weekly_lead_closure_settings"]["Row"];

const RECIPIENTS_KEY = ["weekly-lead-closure", "recipients"] as const;

export function useWeeklyLeadClosureRecipients() {
  return useQuery({
    queryKey: RECIPIENTS_KEY,
    queryFn: async (): Promise<ClosureRecipientRow[]> => {
      const { data, error } = await supabase
        .from("weekly_lead_closure_settings")
        .select("*")
        .order("recipient_email");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddClosureRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from("weekly_lead_closure_settings")
        .insert({ recipient_email: email.trim().toLowerCase(), is_active: true });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECIPIENTS_KEY }),
  });
}

export function useToggleClosureRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("weekly_lead_closure_settings")
        .update({ is_active: input.isActive })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECIPIENTS_KEY }),
  });
}

export function useRemoveClosureRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("weekly_lead_closure_settings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECIPIENTS_KEY }),
  });
}
