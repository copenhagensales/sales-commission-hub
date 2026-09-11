import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

export type ComplianceAlert = Database["public"]["Tables"]["compliance_alerts"]["Row"];
export type ComplianceCheckRun = Database["public"]["Tables"]["compliance_check_runs"]["Row"];
export type IngestionKnownField = Database["public"]["Tables"]["ingestion_known_fields"]["Row"];

export type FieldDecision = "BEHOLD" | "BLOKER" | "UAFKLARET";

/** Alvorsgrader sorteres altid i denne rækkefølge — mest alvorlige først. */
export const SEVERITY_ORDER: Record<string, number> = {
  KRITISK: 0,
  HOEJ: 1,
  MIDDEL: 2,
  INFO: 3,
};

const DECISION_ORDER: Record<string, number> = {
  UAFKLARET: 0,
  BLOKER: 1,
  BEHOLD: 2,
};

/** Åbne og kvitterede alarmer + seneste kørsel. Rører ikke selve kontrollerne. */
export function useComplianceAlerts() {
  return useQuery({
    queryKey: ["compliance-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_alerts")
        .select("*")
        .in("status", ["open", "acknowledged"]);
      if (error) throw error;
      return (data ?? []).sort((a, b) => {
        const sa = SEVERITY_ORDER[a.severity] ?? 9;
        const sb = SEVERITY_ORDER[b.severity] ?? 9;
        if (sa !== sb) return sa - sb;
        if (a.status !== b.status) return a.status === "open" ? -1 : 1;
        return new Date(a.first_seen).getTime() - new Date(b.first_seen).getTime();
      });
    },
    staleTime: 60_000,
  });
}

export function useLastComplianceRun() {
  return useQuery({
    queryKey: ["compliance-check-runs", "latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_check_runs")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ComplianceCheckRun | null;
    },
    staleTime: 60_000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from("compliance_alerts")
        .update({
          status: "acknowledged",
          acknowledged_by: user?.id ?? null,
          acknowledged_at: new Date().toISOString(),
          note: note.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-alerts"] });
    },
  });
}

export function useRunComplianceChecks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("compliance_run_and_log", { p_by: "manuel" });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["compliance-check-runs", "latest"] });
    },
  });
}

/** Feltregistret. UAFKLARET øverst, derefter nyeste felter først. */
export function useIngestionKnownFields(decision: FieldDecision | "ALLE") {
  return useQuery({
    queryKey: ["ingestion-known-fields", decision],
    queryFn: async () => {
      let query = supabase.from("ingestion_known_fields").select("*");
      if (decision !== "ALLE") query = query.eq("decision", decision);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).sort((a, b) => {
        const da = DECISION_ORDER[a.decision] ?? 9;
        const db = DECISION_ORDER[b.decision] ?? 9;
        if (da !== db) return da - db;
        return new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime();
      });
    },
    staleTime: 60_000,
  });
}

export function useUpdateFieldDecision() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: FieldDecision;
      note: string;
    }) => {
      const { error } = await supabase
        .from("ingestion_known_fields")
        .update({
          decision,
          note: note.trim() || null,
          decided_by: user?.id ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-known-fields"] });
    },
  });
}
