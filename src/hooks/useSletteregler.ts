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
export type SletteregelStatus = "kladde" | "proevet" | "godkendt" | "aktiverer" | "aktiv";
export type AendringType = "frist" | "beskyt" | "ophaev";
export type SletteregelMaal = { maal: "klient"; klient_id: string } | { maal: "kampagne"; klientkampagne_id: string } | { maal: "kolonne"; katalog_id: string };
export type Klientfrist = Database["public"]["Tables"]["sb_klient_sletteregel"]["Row"];

export const SLETTEREGEL_STATUS: Record<SletteregelStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  kladde: { label: "Kladde", variant: "outline" },
  proevet: { label: "Prøvet", variant: "secondary" },
  godkendt: { label: "Godkendt", variant: "secondary" },
  aktiverer: { label: "Aktiverer", variant: "secondary" },
  aktiv: { label: "Aktiv", variant: "default" },
};

export const SR_KEYS = {
  aendringer: ["sb-sletteregel-aendringer"] as const,
  afgoerelser: ["sb-kampagne-afgoerelser"] as const,
  grundlag: ["sb-sletteregel-grundlag"] as const,
};

/** Alle ændringer (RLS: ledere læser). Åbne (status ≠ aktiv) + historik (aktiv). */
/** @param enabled false = fanen må ikke læse sletteregler (rettighedsnøgle, SR3a Codex r1 P2) – ingen forespørgsel sendes */
export function useSletteregelAendringer(enabled = true) {
  return useQuery({
    queryKey: SR_KEYS.aendringer,
    enabled,
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
export function useSletteregelNavne(enabled = true) {
  return useQuery({
    queryKey: ["sb-sletteregel-navne"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_master_data").select("auth_user_id, first_name, last_name").not("auth_user_id", "is", null);
      if (error) return new Map<string, string>();
      return new Map((data ?? []).map((e) => [e.auth_user_id as string, `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim()] as const));
    },
    staleTime: 10 * 60 * 1000,
  });
}

export type Taelling = {
  skaering?: string; maalt?: string; frist_dage?: number | null; anvendt_frist?: number | null; bemaerkning?: string; advarsel?: string; kampagner_antal?: number; undtagelser?: number; varighed_ms?: number;
  dialer_calls?: { raekker?: number; emner?: number }; dialer_leads?: { raekker?: number }; dialer_sessions?: { raekker?: number; emner?: number }; adversus_events?: { raekker?: number }; salg?: { raekker?: number };
};

/** Tælling med de GÆLDENDE regler for samme kampagner/klientkampagner – til sammenligning i dialogen (samme afgrænsning som tørkørslen). */
export function useGaeldendeTaelling(kampagner: string[], klientkampagner: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["sb-sletteregel-gaeldende", ...kampagner, "|", ...klientkampagner],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sb_sletteregel_taelling", { p_kamp: kampagner, p_klientkampagner: klientkampagner, p_frist: null, p_kat_id: null, p_kat_frist: null });
      if (error) throw error;
      return data as Taelling;
    },
    enabled: enabled && (kampagner.length > 0 || klientkampagner.length > 0),
    staleTime: 60 * 1000,
  });
}

const tal = (v: number | null | undefined) => (v ?? 0).toLocaleString("da-DK");
const dato = (iso: string | undefined) => (iso ? new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" }) : "–");
const flertal = (n: number | undefined, ental: string, fl: string) => `${tal(n)} ${(n ?? 0) === 1 ? ental : fl}`;

/** Tørkørslen i menneskesprog: dato, hvad der rammes, og forskellen til den gældende regel. */
export type Kilde = "klient" | "kampagne" | null;
export function forklarToerkoersel(r: (Taelling & { kolonne?: string }) | null | undefined, gaeldende?: Taelling | null, gaeldendeFrist?: number | null, kilde?: Kilde): string[] {
  if (!r) return [];
  const linjer: string[] = [];
  const harTal = !!r.dialer_calls || !!r.dialer_sessions || !!r.salg || !!r.dialer_leads;
  if (harTal) {
    const frist = r.anvendt_frist ?? r.frist_dage;
    const skaering = r.skaering ?? (frist != null && r.maalt ? new Date(new Date(r.maalt).getTime() - frist * 86400000).toISOString() : undefined);  // tællingen gemmer måletidspunkt, ikke skæring
    const dele = [
      r.dialer_calls && `${flertal(r.dialer_calls.raekker, "kald", "kald")} fra ${flertal(r.dialer_calls.emner, "kunde", "kunder")}`,
      r.dialer_leads && (r.dialer_leads.raekker ?? 0) > 0 && flertal(r.dialer_leads.raekker, "emne", "emner"),
      r.dialer_sessions && (r.dialer_sessions.raekker ?? 0) > 0 && flertal(r.dialer_sessions.raekker, "session", "sessions"),
      r.adversus_events && (r.adversus_events.raekker ?? 0) > 0 && flertal(r.adversus_events.raekker, "hændelse", "hændelser"),
      r.salg && `${tal(r.salg.raekker)} salg`,
    ].filter(Boolean) as string[];
    if (r.kolonne) linjer.push(`${frist != null ? `${frist} dage på kolonnen: ` : ""}i de berørte kampagner ryddes i alt ${dele.join(", ")} (efter kampagnens eller kolonnens frist, den korteste gælder).`);
    else linjer.push(`${frist != null ? `${frist} dage: ` : ""}alt før ${dato(skaering)} ryddes – ${dele.join(", ")}.`);
    if (typeof r.kampagner_antal === "number") linjer.push(`Gælder ${flertal(r.kampagner_antal, "kampagne", "kampagner")}${(r.undtagelser ?? 0) > 0 ? ` (${flertal(r.undtagelser, "kampagne", "kampagner")} med egen frist følger ikke med)` : ""}.`);
    if (gaeldende !== undefined) {
      if (gaeldendeFrist == null && !r.kolonne) linjer.push("I dag er der ingen regel, så intet ryddes og intet hentes.");
      else if (gaeldende === null) linjer.push("Sammenligningen med den gældende regel kunne ikke hentes.");
      else if (gaeldende && r.kolonne) {  // kolonne: samme tælling med de gældende regler (Codex r2/r3 P2-3) – forskellen er det, kolonnefristen tilføjer eller fjerner
        const dk = (gaeldende.dialer_calls?.raekker ?? 0), nk = (r.dialer_calls?.raekker ?? 0);
        linjer.push(`I dag (${gaeldendeFrist == null ? "følger kampagnens frist" : `egen frist ${gaeldendeFrist} dage`}) ryddes ${tal(dk)} kald i de samme kampagner – den nye kolonnefrist ${nk === dk ? "ændrer ikke antallet" : `${nk > dk ? "tilføjer" : "fjerner"} ${tal(Math.abs(nk - dk))} kald`}.`);
      }
      else if (gaeldende) {
        const dk = (gaeldende.dialer_calls?.raekker ?? 0), nk = (r.dialer_calls?.raekker ?? 0), ds = (gaeldende.salg?.raekker ?? 0), ns = (r.salg?.raekker ?? 0);
        const diff = (n: number, g: number, hvad: string) => (n === g ? `lige så mange ${hvad}` : `${tal(Math.abs(n - g))} ${n > g ? "flere" : "færre"} ${hvad}`);
        const kildeTekst = kilde === "klient" ? ", fra klient" : kilde === "kampagne" ? ", egen" : "";
        if (r.kolonne) linjer.push(`I dag (${gaeldendeFrist} dage${kildeTekst}) rammes ${tal(dk)} kald – den nye frist rammer ${diff(nk, dk, "kald")}.`);
        else linjer.push(`I dag (${gaeldendeFrist} dage${kildeTekst}) rammes ${tal(dk)} kald og ${tal(ds)} salg – den nye frist rammer ${diff(nk, dk, "kald")} og ${diff(ns, ds, "salg")}.`);
      }
    }
  }
  if (r.bemaerkning && !(typeof r.undtagelser === "number" && r.bemaerkning.includes("egen frist og følger ikke"))) linjer.push(r.bemaerkning);  // undtagelserne er allerede nævnt
  if (r.advarsel) linjer.push(r.advarsel);
  return linjer;
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

// ---------- SR3b: beskyttede kolonner ----------
export type BeskyttelseTilstand = "ingen" | "flytter" | "beskyttet" | "ophaever";
export const BESKYTTELSE_NOEGLE = "se_beskyttede_kaldsfelter";

/** Trækker en kladde/prøvet/godkendt ændring tilbage (RPC sb_sletteregel_fortryd; aktiv/aktiverer kan ikke fortrydes). */
export function useFortrydAendring() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("sb_sletteregel_fortryd", { p_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalider(),
    onError: (e) => toast.error("Ændringen kunne ikke fortrydes: " + fejltekst(e)),
  });
}

/** Opretter en beskyt-/ophaev-ændring (kladde) for en katalogkolonne. */
export function useOpretBeskyttelse() {
  const invalider = useSletteregelInvalidering();
  return useMutation({
    mutationFn: async ({ katalog_id, type }: { katalog_id: string; type: "beskyt" | "ophaev" }) => {
      const { data, error } = await supabase.from("sb_sletteregel_aendring").insert({ maal: "kolonne", katalog_id, aendring_type: type }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => invalider(),
    onError: (e) => toast.error("Kladden kunne ikke oprettes: " + fejltekst(e)),
  });
}

export type FlytRest = { katalog_id: string; retning: string; rest: number | null; flyttet: number; koert: string; fejl: string | null };
/** Seneste flytter-journal pr. kolonne under flytning (»N tilbage«) – kun journaler fra den AKTUELLE aktivering (retning + efter beskyttelse_aendret); RLS: ledere læser.
 *  Mens noget flytter, genhentes også katalog og ændringer, så »aktiverer« forsvinder, når flytteren er færdig (Codex UI r1). */
export function useFlytRest(kolonner: { id: string; retning: string; siden: string | null }[], enabled = true) {
  const qc = useQueryClient();
  const ids = kolonner.map((k) => k.id);
  return useQuery({
    queryKey: ["sb-kald-flyt-rest", [...ids].sort().join(","), kolonner.map((k) => k.siden ?? "").join(",")],
    enabled: enabled && ids.length > 0,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("sb_kald_flyt_log").select("katalog_id, retning, rest, flyttet, koert, fejl").in("katalog_id", ids).order("koert", { ascending: false }).limit(300);
      if (error) throw error;
      const m = new Map<string, FlytRest>();
      for (const r of data ?? []) {
        const k = kolonner.find((x) => x.id === r.katalog_id);
        if (!k || r.retning !== k.retning || (k.siden && r.koert < k.siden)) continue;
        if (!m.has(r.katalog_id)) m.set(r.katalog_id, r as FlytRest);
      }
      void qc.invalidateQueries({ queryKey: ["kald-felt-katalog"] });
      void qc.invalidateQueries({ queryKey: SR_KEYS.aendringer });
      return m;
    },
  });
}

/** Databasens ejerafgørelse (public.is_owner = RLS'ens; dækker også ejer via system_roles) – Codex UI r2 P2-5. */
export function useErEjerDb() {
  return useQuery({
    queryKey: ["sb-er-ejer-db"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data, error } = await supabase.rpc("is_owner", { _user_id: u.user.id });
      if (error) throw error;
      return !!data;
    },
  });
}

/** Antal aktive brugere med rettighedsnøglen (rolle via stilling, personlige grants/denies, ejer via stilling ELLER system_roles) – spejler has_page_permission.
 *  Kun retvisende for ejer/superadmin (RLS skjuler andres grants/denies og system_roles for øvrige) – kaldes derfor kun med enabled = ejer/superadmin (Codex UI r2 P2-6). */
export function useNoegleBrugere(noegle: string, roller: string[] | undefined, enabled = true) {
  return useQuery({
    queryKey: ["sb-noegle-brugere", noegle, (roller ?? []).join(",")],
    enabled: enabled && roller !== undefined,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [ans, pos, upp, sr] = await Promise.all([
        supabase.from("employee_master_data").select("auth_user_id, position_id, job_title, is_active").eq("is_active", true).not("auth_user_id", "is", null),
        supabase.from("job_positions").select("id, system_role_key"),
        supabase.from("user_page_permissions").select("user_id, mode, can_view").eq("permission_key", noegle),
        supabase.from("system_roles").select("user_id, role").eq("role", "ejer"),
      ]);
      if (ans.error) throw ans.error; if (pos.error) throw pos.error; if (upp.error) throw upp.error; if (sr.error) throw sr.error;
      const ejere = new Set((sr.data ?? []).map((r) => r.user_id as string));
      const rolle = new Map((pos.data ?? []).map((p) => [p.id as string, p.system_role_key as string]));
      const deny = new Set((upp.data ?? []).filter((u) => u.mode === "deny").map((u) => u.user_id as string));
      const grant = new Set((upp.data ?? []).filter((u) => u.mode === "grant" && u.can_view).map((u) => u.user_id as string));
      const r = new Set(roller ?? []);
      return (ans.data ?? []).filter((e) => {
        const uid = e.auth_user_id as string;
        if (deny.has(uid)) return false;
        if (grant.has(uid)) return true;
        if (e.position_id && r.has(rolle.get(e.position_id as string) ?? "")) return true;
        return (e.job_title ?? "").toLowerCase() === "ejer" || ejere.has(uid);
      }).length;
    },
  });
}

export type BeskyttetLog = Database["public"]["Tables"]["sb_kald_beskyttet_log"]["Row"];
/** Læs-spor for beskyttede kaldsfelter (RLS: ejer/superadmin). */
export function useBeskyttetLog(enabled = true) {
  return useQuery({
    queryKey: ["sb-kald-beskyttet-log"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("sb_kald_beskyttet_log").select("*").order("laest", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as BeskyttetLog[];
    },
  });
}

/** Roller, der har rettighedsnøglen (role_page_permissions.can_view) – til kolonnen »Adgang«. */
export function useNoegleRoller(noegle: string, enabled = true) {
  return useQuery({
    queryKey: ["sb-noegle-roller", noegle],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("role_page_permissions").select("role_key, can_view").eq("permission_key", noegle);
      if (error) throw error;
      return (data ?? []).filter((r) => r.can_view).map((r) => r.role_key as string).sort();
    },
  });
}

