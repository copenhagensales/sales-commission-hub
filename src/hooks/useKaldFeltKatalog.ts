import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Feltkatalog for dialer-data (plan v2.5 F1b, A1): hvilke felter en API kan levere, hvor de gemmes,
 * om de hentes, klassifikation og retention. Kataloget indeholder ingen persondata (kun felt-definitioner).
 * Læsning for alle ansatte, skrivning kun ejer/superadmin (RLS). Hentning og oprydning læser kataloget (F1b-2).
 */
export type KatalogFelt = Database["public"]["Tables"]["kald_felt_katalog"]["Row"];
export type KatalogKlassifikation = "teknisk" | "forretning" | "person" | "identifikator" | "foelsom" | "ukendt";
export type KatalogStatus = "aktiv" | "inaktiv" | "forslag" | "skabelon";

export const KATALOG_KLASSIFIKATIONER: { value: KatalogKlassifikation; label: string }[] = [
  { value: "teknisk", label: "Teknisk" },
  { value: "forretning", label: "Forretning" },
  { value: "person", label: "Personoplysning" },
  { value: "identifikator", label: "Identifikator" },
  { value: "foelsom", label: "Følsom" },
  { value: "ukendt", label: "Ikke klassificeret" },
];

export const KATALOG_ENDPOINTS: { endpoint: string; label: string }[] = [
  { endpoint: "/calls", label: "Kald" },
  { endpoint: "/sessions", label: "Sessioner" },
  { endpoint: "/leads", label: "Emner" },
  { endpoint: "/recordings", label: "Optagelser" },
  { endpoint: "/campaign-fields", label: "Kampagnefelter" },
  { endpoint: "/cdr", label: "Kald (legacy /cdr)" },
  { endpoint: "enreach/calls", label: "Kald" },
];

const KEYS = {
  katalog: (kilde?: string) => (kilde ? (["kald-felt-katalog", kilde] as const) : (["kald-felt-katalog"] as const)),
  daekning: (dage: number) => ["kald-felt-daekning", dage] as const,
};

/** Kataloget – alle kilder eller én API-nøgle (api_register.noegle). */
export function useKaldFeltKatalog(kilde?: string) {
  return useQuery({
    queryKey: KEYS.katalog(kilde),
    queryFn: async () => {
      let q = supabase.from("kald_felt_katalog").select("*").order("endpoint").order("kampagne_ekstern_id").order("felt_sti");
      if (kilde) q = q.eq("kilde", kilde);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as KatalogFelt[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type Daekning = { antal: number; total: number };

/** Dækningsgrad pr. felt de sidste `dage` dage (RPC kald_felt_daekning, F1b-2): nøgle = `${maal_tabel}|metadata:<nøgle>` eller `${maal_tabel}|kolonne:<kolonne>`. */
export function useKaldFeltDaekning(dage = 7) {
  return useQuery({
    queryKey: KEYS.daekning(dage),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kald_felt_daekning", { p_dage: dage });
      if (error) throw error;
      const m = new Map<string, Daekning>();
      for (const r of data ?? []) m.set(`${r.maal_tabel}|${r.noegle}`, { antal: Number(r.antal), total: Number(r.total) });
      return m;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function daekningNoegle(f: KatalogFelt): string | null {
  if (!f.maal_tabel) return null;
  if (f.maal_kolonne) return `${f.maal_tabel}|kolonne:${f.maal_kolonne}`;
  if (f.metadata_noegle) return `${f.maal_tabel}|metadata:${f.metadata_noegle}`;
  return null;
}

export type KatalogFeltAendring = Partial<
  Pick<KatalogFelt, "hentes" | "klassifikation" | "retention_dage" | "begrundelse" | "status" | "historik">
>;

/** Opdaterer ét felt. Audit skrives af DB-trigger (hvem/hvornår/gammel→ny). */
export function useOpdaterKatalogFelt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aendring }: { id: string; aendring: KatalogFeltAendring }) => {
      const { error } = await supabase.from("kald_felt_katalog").update(aendring).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kald-felt-katalog"] });
    },
    onError: (e: Error) => {
      toast.error(`Kunne ikke gemme feltet: ${e.message}`);
    },
  });
}
