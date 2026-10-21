import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type BreachRow = Tables["compliance_breach_log"]["Row"];
export type BreachInsert = Tables["compliance_breach_log"]["Insert"];
export type AssessmentRow = Tables["compliance_impact_assessments"]["Row"];
export type AssessmentInsert = Tables["compliance_impact_assessments"]["Insert"];

const BREACH_KEY = ["compliance-breach-log"];
const ASSESS_KEY = ["compliance-impact-assessments"];

/** De otte spørgsmål fra procedure for konsekvensvurdering pkt. 3.1. */
export const ASSESSMENT_QUESTIONS = [
  { field: "q1_purpose", label: "Hvad er formålet, og for hvilke kunder?" },
  { field: "q2_data", label: "Hvilke oplysninger behandles, og er der følsomme oplysninger (fx fagforenings- eller a-kassemedlemskab, helbred) eller oplysninger om mange registrerede?" },
  { field: "q3_instruction", label: "Er behandlingen dækket af kundens instruks i databehandleraftalen, eller kræver den en opdatering/allonge?" },
  { field: "q4_minimization", label: "Kan formålet nås med færre oplysninger, med pseudonymiserede oplysninger eller med kortere opbevaring?" },
  { field: "q5_access", label: "Hvem får adgang, og hvordan styres adgangen?" },
  { field: "q6_hosting", label: "Hvor hostes oplysningerne, og sker der overførsel til tredjelande?" },
  { field: "q7_risk", label: "Hvad er risikoen for de registrerede ved tab, lækage eller misbrug, og hvilke foranstaltninger nedbringer den?" },
  { field: "q8_retention", label: "Hvilken slettepolitik gælder, og er den sat op, før behandlingen starter?" },
] as const;

export const SUBJECT_TYPES: Record<string, string> = {
  system: "System",
  integration: "Integration",
  felt: "Felt",
  anvendelse: "Anvendelse",
  aendring: "Ændring",
};

export function useComplianceClients() {
  return useQuery({
    queryKey: ["compliance-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300_000,
  });
}

export function useBreachLog() {
  return useQuery({
    queryKey: BREACH_KEY,
    queryFn: async (): Promise<BreachRow[]> => {
      const { data, error } = await supabase
        .from("compliance_breach_log")
        .select("*")
        .order("discovered_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveBreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: BreachInsert }) => {
      const res = id
        ? await supabase.from("compliance_breach_log").update(values).eq("id", id)
        : await supabase.from("compliance_breach_log").insert(values);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BREACH_KEY }),
  });
}

export function useImpactAssessments() {
  return useQuery({
    queryKey: ASSESS_KEY,
    queryFn: async (): Promise<AssessmentRow[]> => {
      const { data, error } = await supabase
        .from("compliance_impact_assessments")
        .select("*")
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: AssessmentInsert }) => {
      const res = id
        ? await supabase.from("compliance_impact_assessments").update(values).eq("id", id)
        : await supabase.from("compliance_impact_assessments").insert(values);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSESS_KEY }),
  });
}

export function useApproveAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("compliance_impact_assessments")
        .update({ status: "approved" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSESS_KEY }),
  });
}
