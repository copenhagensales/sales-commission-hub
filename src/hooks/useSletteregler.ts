import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Sletteregler-UI (krav 4/11-2026, fase0/samtaler/sletteregler-ui-krav.md; A: klienten er reglen, kampagnen undtagelsen): én ændring pr. regel
 * (klientfrist, kampagnefrist eller kolonnefrist) gennem kladde → prøvet → godkendt → aktiv. Gældende frister bor i sb_klient_sletteregel (klient),
 * campaign_retention_policies (kampagne, regel_kilde = klient/kampagne) og kald_felt_katalog (kolonne);
 * de skrives kun af aktiverings-RPC'en (kun superadmin). Alle læsninger via React Query – ingen supabase i komponenter.
 */
export type SletteregelAendring = Database["public"]["Tables"]["sb_sletteregel_aendring"]["Row"];
export type KampagneAfgoerelse = Database["public"]["Tables"]["sb_kampagne_afgoerelse"]["Row"];
export type SletteregelStatus = "kladde" | "proevet" | "godkendt" | "aktiv";
export type SletteregelMaal = { maal: "klient"; klient_id: string } | { maal: "kampagne"; klientkampagne_id: string } | { maal: "kolonne"; katalog_id: string };
export type Klientfrist = Database["public"]["Tables"]["sb_klient_sletteregel"]["Row"];

export const SLETTEREGEL_STATUS: Record<SletteregelStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  kladde: { label: "Kladde", variant: "outline" },
  proevet: { label: "Prøvet", variant: "secondary" },
  godkendt: { label: "Godkendt", variant: "secondary" },
  aktiv: { label: "Aktiv", variant: "default" },
};

export const SR_KEYS = {
  aendringer: ["sb-sletteregel-aendringer"] as const,
  afgoerelser: ["sb-kampagne-afgoerelser"] as const,
  grundlag: ["sb-sletteregel-grundlag"] as const,
};

/** Alle ændringer (RLS: ledere læser). Åbne (status ≠ aktiv) + historik (aktiv). */
export function useSletteregelAendringer() {
  return useQuery({
    queryKey: SR_KEYS.aendringer,
    queryFn: async () => {
      const { data, error } = await supabase.from("sb_sletteregel_aendring").select("*").order("aendret", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SletteregelAendring[];
    },
    staleTime: 30 * 1000,
  });
}

export function useKampagneAfgoerelser() {
  return useQuery({
    queryKey: SR_KEYS.afgoerelser,
    queryFn: async () => {
      const { data, error } = await supabase.from("sb_kampagne_afgoerelse").select("*");
      if (error) throw error;
      return (data ?? []) as KampagneAfgoerelse[];
    },
    staleTime: 60 * 1000,
  });
}

export type Kobling = { adversus_campaign_id: string; adversus_campaign_name: string | null; client_campaign_id: string | null };
export type Klientkampagne = { id: string; name: string; client_id: string; klient: string };
export type Kampagnepolitik = { client_campaign_id: string; retention_days: number | null; is_active: boolean; regel_kilde: string | null };

/** Grundlaget for tabellen: koblinger (dialer-kampagne → klientkampagne), klientkampagner med klient, gældende kampagnepolitikker. */
export function useSletteregelGrundlag() {
  return useQuery({
    queryKey: SR_KEYS.grundlag,
    queryFn: async () => {
      const [map, kamp, kl, pol, kf] = await Promise.all([
        supabase.from("adversus_campaign_mappings").select("adversus_campaign_id, adversus_campaign_name, client_campaign_id"),
        supabase.from("client_campaigns").select("id, name, client_id"),
        supabase.from("clients").select("id, name"),
        supabase.from("campaign_retention_policies").select("client_campaign_id, retention_days, is_active, regel_kilde"),
        supabase.from("sb_klient_sletteregel").select("*"),
      ]);
      for (const r of [map, kamp, kl, pol, kf]) if (r.error) throw r.error;
      const klientNavn = new Map((kl.data ?? []).map((k) => [k.id, k.name] as const));
      const klientkampagner: Klientkampagne[] = (kamp.data ?? [])
        .map((k) => ({ id: k.id, name: k.name, client_id: k.client_id, klient: klientNavn.get(k.client_id) ?? "" }))
        .sort((a, b) => `${a.klient} ${a.name}`.localeCompare(`${b.klient} ${b.name}`, "da"));
      return {
        koblinger: new Map((map.data ?? []).map((m) => [m.adversus_campaign_id, m as Kobling] as const)),
        klientkampagner,
        klientkampagnePrId: new Map(klientkampagner.map((k) => [k.id, k] as const)),
        politikker: new Map((pol.data ?? []).map((p) => [p.client_campaign_id, p as Kampagnepolitik] as const)),
        klientNavn,
        klientfrister: new Map((kf.data ?? []).map((k) => [k.client_id, k as Klientfrist] as const)),
      };
    },
    staleTime: 60 * 1000,
  });
}

function fejltekst(e: unknown): string {
  const m = (e as { message?: string; code?: string })?.message ?? String(e);
  if ((e as { code?: string })?.code === "23505" || m.includes("sb_sletteregel_aendring_aaben")) return "Der er allerede en åben ændring for denne regel – ret eller slet den først.";
  return m;
}

function useSletteregelInvalidering() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      predicate: (q) => {
        const k = String(q.queryKey[0] ?? "");
        return k.startsWith("sb-") || k.startsWith("kald-") || k.startsWith("api-register") || k.startsWith("retention") || k === "kald-felt-katalog";
      },
    });
}

/** Opret kladde (eller ret en åben kladdes frist). frist_dage = null → »ingen frist« (kampagne: reglen fjernes). */
export function useGemKladde() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async ({ maal, frist_dage, aabenId }: { maal: SletteregelMaal; frist_dage: number | null; aabenId?: string }) => {
      if (aabenId) {
        const { error } = await supabase.from("sb_sletteregel_aendring").update({ frist_dage }).eq("id", aabenId);
        if (error) throw error;
        return aabenId;
      }
      const raekke = maal.maal === "klient" ? { maal: "klient", klient_id: maal.klient_id, frist_dage } : maal.maal === "kampagne" ? { maal: "kampagne", klientkampagne_id: maal.klientkampagne_id, frist_dage } : { maal: "kolonne", katalog_id: maal.katalog_id, frist_dage };
      const { data, error } = await supabase.from("sb_sletteregel_aendring").insert(raekke).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => invalider(),
    onError: (e) => toast.error("Kladden kunne ikke gemmes: " + fejltekst(e)),
  });
}

export function useSletKladde() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sb_sletteregel_aendring").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalider(),
    onError: (e) => toast.error("Kunne ikke slette: " + fejltekst(e)),
  });
}

export function useProevSletteregel() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("sb_sletteregel_proev", { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalider(),
    onError: (e) => toast.error("Tørkørslen fejlede: " + fejltekst(e)),
  });
}

export function useGodkendSletteregel() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("sb_sletteregel_godkend", { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalider(),
    onError: (e) => toast.error("Kunne ikke godkende: " + fejltekst(e)),
  });
}

/** Aktivering – kun superadmin (databasen afviser andre), begrundelse påkrævet. Skriver den gældende frist. */
export function useAktiverSletteregel() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async ({ id, begrundelse }: { id: string; begrundelse: string }) => {
      const { data, error } = await supabase.rpc("sb_sletteregel_aktiver", { p_id: id, p_begrundelse: begrundelse });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Sletteregel aktiveret – gælder fra næste hentning og oprydning.");
      invalider();
    },
    onError: (e) => toast.error("Kunne ikke aktivere: " + fejltekst(e)),
  });
}

/** »Hentes ikke« pr. dialer-kampagne (ejer). Porten er uændret – kampagnen forlader blot »mangler«-listen. */
export function useSaetHentesIkke() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async ({ kampagne_ekstern_id, begrundelse }: { kampagne_ekstern_id: string; begrundelse: string }) => {
      const { error } = await supabase.from("sb_kampagne_afgoerelse").insert({ kampagne_ekstern_id, begrundelse });
      if (error) throw error;
    },
    onSuccess: () => invalider(),
    onError: (e) => toast.error("Kunne ikke gemme afgørelsen: " + fejltekst(e)),
  });
}

export function useFjernHentesIkke() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async (kampagne_ekstern_id: string) => {
      const { error } = await supabase.from("sb_kampagne_afgoerelse").delete().eq("kampagne_ekstern_id", kampagne_ekstern_id);
      if (error) throw error;
    },
    onSuccess: () => invalider(),
    onError: (e) => toast.error("Kunne ikke fjerne afgørelsen: " + fejltekst(e)),
  });
}

/** Kobl dialer-kampagne til klientkampagne (samme skrivning som MgTest; teamleder+). Nye klientkampagner oprettes i MgTest. */
export function useKoblKampagne() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async ({ adversus_campaign_id, client_campaign_id }: { adversus_campaign_id: string; client_campaign_id: string | null }) => {
      const { error } = await supabase.from("adversus_campaign_mappings").update({ client_campaign_id }).eq("adversus_campaign_id", adversus_campaign_id);
      if (error) throw error;
    },
    onSuccess: () => invalider(),
    onError: (e) => toast.error("Kunne ikke koble kampagnen: " + fejltekst(e)),
  });
}

/** Navne på dem, der har aktiveret (ejer/leder læser medarbejderstamdata); ukendte vises som »superadmin«. */
export function useSletteregelNavne() {
  return useQuery({
    queryKey: ["sb-sletteregel-navne"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_master_data").select("auth_user_id, first_name, last_name").not("auth_user_id", "is", null);
      if (error) return new Map<string, string>();
      return new Map((data ?? []).map((e) => [e.auth_user_id as string, `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim()] as const));
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Tørkørslens resultat som kort tekst. */
export function toerkoerselTekst(r: unknown): string {
  const o = (r ?? {}) as Record<string, { raekker?: number; emner?: number } | string | number | undefined>;
  if (!r) return "–";
  const dele: string[] = [];
  const tal = (v: number | undefined) => (v ?? 0).toLocaleString("da-DK");
  const c = o.dialer_calls as { raekker?: number; emner?: number } | undefined;
  const l = o.dialer_leads as { raekker?: number } | undefined;
  const s = o.dialer_sessions as { raekker?: number; emner?: number } | undefined;
  const e = o.adversus_events as { raekker?: number } | undefined;
  const sa = o.salg as { raekker?: number } | undefined;
  if (c) dele.push(`${tal(c.raekker)} kald` + (c.emner != null ? ` (${tal(c.emner)} emner)` : ""));
  if (l) dele.push(`${tal(l.raekker)} emner`);
  if (s) dele.push(`${tal(s.raekker)} sessions`);
  if (e) dele.push(`${tal(e.raekker)} hændelser`);
  if (sa) dele.push(`${tal(sa.raekker)} salg`);
  if (typeof o.kampagner_antal === "number") dele.push(`${o.kampagner_antal} kampagner` + (typeof o.undtagelser === "number" && o.undtagelser > 0 ? ` (${o.undtagelser} med egen frist)` : ""));
  if (typeof o.bemaerkning === "string") dele.push(o.bemaerkning);
  return dele.join(" · ") || "–";
}
