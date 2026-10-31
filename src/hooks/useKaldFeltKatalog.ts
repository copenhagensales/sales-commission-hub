import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Feltkatalog for dialer-data (plan v2.5 F1b, A1): hvilke felter Adversus/Enreach kan levere, hvor de gemmes,
 * om de hentes, klassifikation og retention. Kataloget indeholder ingen persondata (kun felt-definitioner).
 * Læsning for alle ansatte, skrivning kun ejer/superadmin (RLS). Hentning og oprydning læser kataloget fra F1b-2.
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
];

const KEYS = {
  katalog: ["kald-felt-katalog"] as const,
};

export function useKaldFeltKatalog() {
  return useQuery({
    queryKey: KEYS.katalog,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kald_felt_katalog")
        .select("*")
        .order("endpoint")
        .order("felt_sti");
      if (error) throw error;
      return (data ?? []) as KatalogFelt[];
    },
    staleTime: 5 * 60 * 1000,
  });
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
      qc.invalidateQueries({ queryKey: KEYS.katalog });
    },
    onError: (e: Error) => {
      toast.error(`Kunne ikke gemme feltet: ${e.message}`);
    },
  });
}
