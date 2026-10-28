import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HoldValg { noegle: string; navn: string; start: string; antal: number; adHoc: boolean }

/** Kohorter til holdvælgeren (navn, startdato, antal startere). */
export function useOpstartsholdListe() {
  return useQuery({
    queryKey: ["opstartshold-liste"],
    staleTime: 300000,
    queryFn: async (): Promise<HoldValg[]> => {
      const { data, error } = await supabase
        .from("onboarding_cohorts")
        .select("id, name, start_date, cohort_members(count)")
        .order("start_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((c) => ({
        noegle: c.id,
        navn: (c.name ?? "").trim() || "Hold",
        start: c.start_date,
        antal: (c.cohort_members as unknown as { count: number }[])?.[0]?.count ?? 0,
        adHoc: false,
      }));
    },
  });
}

export interface OpstartRaekke {
  hold_noegle: string; hold_navn: string; start_dato: string; employee_id: string; navn: string;
  slut_dato: string | null; dag: number; dato: string; linjer: number; hiper: number;
}

/** Linjer pr. sælger pr. arbejdsdag fra RPC'en opstartshold_dage (én kilde). */
export function useOpstartsholdDage(kohorter: string[], adHoc: string[], dage: number) {
  return useQuery({
    queryKey: ["opstartshold-dage", [...kohorter].sort(), [...adHoc].sort(), dage],
    enabled: kohorter.length + adHoc.length > 0,
    queryFn: async (): Promise<OpstartRaekke[]> => {
      const { data, error } = await supabase.rpc("opstartshold_dage", { p_cohort_ids: kohorter, p_ad_hoc_datoer: adHoc, p_dage: dage });
      if (error) throw error;
      return (data ?? []) as OpstartRaekke[];
    },
  });
}
