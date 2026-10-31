import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * F1c – kanonisk lag på tværs af API'er (plan v2.5 F1c): kanoniske værdier pr. begreb (telefonudfald, sessionsudfald, emnestatus – blandes aldrig)
 * og oversættelse af kildeværdier til dem. »ukendt« er en datastatus. Alt er data (kald_kanonisk_vaerdi, kald_vaerdi_mapping), redigeres af ejer (RLS).
 */
export type KanoniskVaerdi = Database["public"]["Tables"]["kald_kanonisk_vaerdi"]["Row"];
export type VaerdiMapping = Database["public"]["Tables"]["kald_vaerdi_mapping"]["Row"];
export type Begreb = "telefonudfald" | "sessionsudfald" | "emnestatus";
export type ObserveretVaerdi = { kilde: string; endpoint: string; felt_sti: string; begreb: string; kildevaerdi: string; antal: number };

export const BEGREB_LABEL: Record<Begreb, string> = {
  telefonudfald: "Telefonudfald",
  sessionsudfald: "Sessionsudfald",
  emnestatus: "Emnestatus",
};
export const MAPPING_STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  aktiv: { label: "Bekræftet", variant: "default" },
  forslag: { label: "Forslag", variant: "outline" },
  ny: { label: "Ny – ikke mappet", variant: "destructive" },
};

const KEYS = {
  kanoniske: ["kald-kanoniske-vaerdier"] as const,
  mapping: ["kald-vaerdi-mapping"] as const,
  observeret: (dage: number) => ["kald-vaerdi-observeret", dage] as const,
};

export function useKanoniskeVaerdier() {
  return useQuery({
    queryKey: KEYS.kanoniske,
    queryFn: async () => {
      const { data, error } = await supabase.from("kald_kanonisk_vaerdi").select("*").order("begreb").order("sort");
      if (error) throw error;
      return (data ?? []) as KanoniskVaerdi[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useVaerdiMapping() {
  return useQuery({
    queryKey: KEYS.mapping,
    queryFn: async () => {
      const { data, error } = await supabase.from("kald_vaerdi_mapping").select("*").order("begreb").order("kilde").order("endpoint").order("felt_sti").order("kildevaerdi");
      if (error) throw error;
      return (data ?? []) as VaerdiMapping[];
    },
    staleTime: 60 * 1000,
  });
}

/** Værdier set i data de sidste `dage` dage (RPC kald_vaerdi_observeret). */
export function useObserveredeVaerdier(dage = 30) {
  return useQuery({
    queryKey: KEYS.observeret(dage),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kald_vaerdi_observeret", { p_dage: dage });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, antal: Number(r.antal) })) as ObserveretVaerdi[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useOpdaterMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aendring }: { id: string; aendring: Partial<Pick<VaerdiMapping, "kanonisk_noegle" | "status" | "begrundelse">> }) => {
      const { error } = await supabase.from("kald_vaerdi_mapping").update(aendring).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.mapping }),
    onError: (e: Error) => toast.error(`Kunne ikke gemme oversættelsen: ${e.message}`),
  });
}

/** Opretter en mapping for en værdi set i data (status ny → ukendt, til den sættes). */
export function useOpretMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { kilde: string; endpoint: string; felt_sti: string; begreb: string; kildevaerdi: string; kanonisk_noegle: string }) => {
      const { error } = await supabase.from("kald_vaerdi_mapping").insert({ ...v, status: v.kanonisk_noegle === "ukendt" ? "ny" : "aktiv" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.mapping }),
    onError: (e: Error) => toast.error(`Kunne ikke oprette oversættelsen: ${e.message}`),
  });
}

export function useOpdaterKanonisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ begreb, noegle, aendring }: { begreb: string; noegle: string; aendring: Partial<Pick<KanoniskVaerdi, "samtale_relevant" | "label_da" | "beskrivelse">> }) => {
      const { error } = await supabase.from("kald_kanonisk_vaerdi").update({ ...aendring, aendret: new Date().toISOString() }).eq("begreb", begreb).eq("noegle", noegle);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.kanoniske }),
    onError: (e: Error) => toast.error(`Kunne ikke gemme den kanoniske værdi: ${e.message}`),
  });
}
