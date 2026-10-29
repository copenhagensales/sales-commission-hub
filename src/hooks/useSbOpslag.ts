// S7-c: tjek, afgørelse, anmeldelse og moderation for opslag og kommentarer (samme værn som Beskeder, 24d/24d2/S7-a).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BEGRUNDELSE_TEKST, type Begrundelse } from "@/hooks/useChat";

export type SbKilde = "opslag" | "kommentar";
export type AnmeldKode = "personoplysning" | "haard_tone" | "upassende" | "spam" | "andet";
export const ANMELD_KODER: { kode: AnmeldKode; tekst: string }[] = [
  { kode: "personoplysning", tekst: "Personoplysninger" },
  { kode: "haard_tone", tekst: "Hård tone" },
  { kode: "upassende", tekst: "Upassende" },
  { kode: "spam", tekst: "Spam" },
  { kode: "andet", tekst: "Andet" },
];
export const anmeldTekst = (kode: string | null | undefined) => ANMELD_KODER.find((k) => k.kode === kode)?.tekst ?? null;

/**
 * Starter tjekket for en ny revision. Udfaldet læses altid fra databasen (aldrig fra svaret); udløbscronen fanger tabte kald.
 * `efter` kaldes, når kaldet er slut (også ved fejl), så kalderen kan genhente status [Codex S7-c P2-1].
 */
export function startTjek(kilde: SbKilde, id: string, revision: number | null | undefined, efter?: () => void): void {
  void supabase.functions.invoke("storkbook-tjek", { body: { type: kilde, id, revision: revision ?? 1 } })
    .catch(() => undefined)
    .finally(() => efter?.());
}

export async function sbAfgoer(kilde: SbKilde, id: string, revision: number, handling: "send" | "traek"): Promise<boolean> {
  const { data, error } = await supabase.rpc("sb_afgoer", { p_kilde: kilde, p_id: id, p_revision: revision, p_handling: handling });
  if (error) throw error;
  return data === true;
}
export async function sbModerer(kilde: SbKilde, id: string, handling: "skjul" | "vis" | "luk_kommentarer" | "aabn_kommentarer", kode?: AnmeldKode | null): Promise<boolean> {
  const { data, error } = await supabase.rpc("sb_moderer", { p_kilde: kilde, p_id: id, p_handling: handling, ...(kode ? { p_kode: kode } : {}) });
  if (error) throw error;
  return data === true;
}
export async function sbAnmeld(kilde: SbKilde, id: string, kode: AnmeldKode): Promise<"ny" | "findes"> {
  const { data, error } = await supabase.rpc("sb_anmeld", { p_kilde: kilde, p_id: id, p_kode: kode });
  if (error) throw error;
  return data === "ny" ? "ny" : "findes";
}

const KENDTE = new Set(Object.keys(BEGRUNDELSE_TEKST));
/** Egen begrundelse for (kilde, id, revision) – kun når status er afventer_afsender. */
export function useSbBegrundelse(kilde: SbKilde, id: string, revision: number | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["sb-begrundelse", kilde, id, revision ?? 0],
    enabled: enabled && !!id,
    retry: 2,
    queryFn: async (): Promise<Begrundelse | null> => {
      const { data, error } = await supabase.from("sb_tjek_begrundelser").select("aarsag_kode")
        .eq("kilde", kilde).eq("kilde_id", id).eq("revision", revision ?? 1).limit(1).maybeSingle();
      if (error) throw error;
      const k = data?.aarsag_kode;
      return k && KENDTE.has(k) ? (k as Begrundelse) : null;
    },
  });
}
/** Beskedteksterne (useChat) med kilden sat ind: »Beskeden …« → »Opslaget …«/»Kommentaren …«. */
export function begrundelseTekst(k: Begrundelse | null | undefined, kilde: SbKilde = "opslag"): string {
  const stor = kilde === "opslag" ? "Opslaget" : "Kommentaren";
  const lille = kilde === "opslag" ? "opslaget" : "kommentaren";
  const t = k ? BEGRUNDELSE_TEKST[k] : "Indholdet kunne ikke tjekkes. Læs det igennem, før du sender.";
  return t.replace(/^Beskeden/, stor).replace(/beskeden/g, lille);
}
