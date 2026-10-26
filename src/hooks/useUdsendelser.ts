import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

export type Udsendelsestype = Database["public"]["Tables"]["udsendelsestyper"]["Row"];
export type Kanal = "mail" | "sms" | "push";
export type UdsendelseLogRaekke = {
  id: string; tidspunkt: string; kanal: string; type_noegle: string; modtager: string;
  emne: string | null; status: string; fejl: string | null;
};

const KEY_TYPER = "udsendelsestyper";
const KEY_LOG = "udsendelser-log";
const KEY_PRAEF = "udsendelsespraeferencer";
export const LOG_SIDE = 50;

/** Typer + sidst sendt og antal de sidste 30 dage (kun ejere kan læse, RLS). */
export function useUdsendelsestyper() {
  return useQuery({
    queryKey: [KEY_TYPER],
    queryFn: async () => {
      const fra = new Date(Date.now() - 30 * 864e5).toISOString();
      const [t, u] = await Promise.all([
        supabase.from("udsendelsestyper").select("*"),
        supabase.from("udsendelser").select("type_noegle, tidspunkt").eq("status", "sendt").gte("tidspunkt", fra)
          .order("tidspunkt", { ascending: false }).limit(10000),
      ]);
      if (t.error) throw t.error;
      if (u.error) throw u.error;
      const stat = new Map<string, { antal: number; sidst: string | null }>();
      for (const r of u.data ?? []) {
        const s = stat.get(r.type_noegle) ?? { antal: 0, sidst: r.tidspunkt };
        s.antal++;
        stat.set(r.type_noegle, s);
      }
      return (t.data ?? [])
        .map((x) => ({ ...x, antal30: stat.get(x.noegle)?.antal ?? 0, sidstSendt: stat.get(x.noegle)?.sidst ?? null }))
        .sort((a, b) => a.kanal.localeCompare(b.kanal) || a.navn.localeCompare(b.navn, "da"));
    },
  });
}

export function useOpdaterUdsendelsestype() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ noegle, ...ret }: { noegle: string } & Partial<Pick<Udsendelsestype, "aktiv" | "navn" | "modtagerregel" | "beskrivelse" | "stille_fra" | "stille_til" | "regel_roller" | "regel_teams" | "regel_noegle" | "push_titel" | "push_tekst" | "push_link">>) => {
      const { error } = await supabase.from("udsendelsestyper").update({ ...ret, opdateret: new Date().toISOString() }).eq("noegle", noegle);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [KEY_TYPER] });
      qc.invalidateQueries({ queryKey: [KEY_MODTAGERE, v.noegle] });
    },
  });
}

const KEY_MODTAGERE = "udsendelse-modtagere";

/** Antal aktive medarbejdere inden for typens gemte modtagerregel (kun ejere). */
export function useUdsendelseModtagerAntal(noegle: string | null) {
  return useQuery({
    queryKey: [KEY_MODTAGERE, noegle],
    enabled: !!noegle,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("udsendelse_modtagere", { p_type: noegle! });
      if (error) throw error;
      return (data ?? []).length;
    },
  });
}

/** Valgmuligheder til modtagerregler: roller og teams. */
export function useRegelValg() {
  return useQuery({
    queryKey: ["udsendelse-regel-valg"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [r, t] = await Promise.all([
        supabase.from("system_role_definitions").select("key, label").order("priority", { ascending: false }),
        supabase.from("teams").select("id, name").order("name"),
      ]);
      if (r.error) throw r.error;
      if (t.error) throw t.error;
      return { roller: r.data ?? [], teams: t.data ?? [] };
    },
  });
}

export interface LogFilter {
  kanal: string; type: string; status: string; periode: "i-dag" | "7" | "30"; tekst: string; historik: boolean;
}

interface LogQuery extends PromiseLike<{ data: unknown[] | null; error: Error | null }> {
  gte(c: string, v: string): LogQuery; lt(c: string, v: string): LogQuery; eq(c: string, v: string): LogQuery;
  or(f: string): LogQuery; order(c: string, o: { ascending: boolean }): LogQuery; range(a: number, b: number): LogQuery;
}

export function useUdsendelseLog(f: LogFilter) {
  return useInfiniteQuery({
    queryKey: [KEY_LOG, f],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const nu = new Date();
      const fra = f.periode === "i-dag"
        ? new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()).toISOString()
        : new Date(nu.getTime() - Number(f.periode) * 864e5).toISOString();
      const kol = "tidspunkt, kanal, type_noegle, modtager, emne, status, fejl" + (f.historik ? ", kilde" : ", id");
      // To kilder med samme kolonner; en smal type undgår union-typer for dybe for TS.
      let q = (f.historik ? supabase.from("udsendelser_historik").select(kol) : supabase.from("udsendelser").select(kol)) as unknown as LogQuery;
      q = q.gte("tidspunkt", fra).order("tidspunkt", { ascending: false })
        .range(pageParam, pageParam + LOG_SIDE - 1);
      if (f.historik) q = q.lt("tidspunkt", new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()).toISOString());
      if (f.kanal !== "alle") q = q.eq("kanal", f.kanal);
      if (f.type !== "alle") q = q.eq("type_noegle", f.type);
      if (f.status !== "alle") q = q.eq("status", f.status);
      const t = f.tekst.trim().replace(/[,()%*]/g, " ");
      if (t) q = q.or(`modtager.ilike.%${t}%,emne.ilike.%${t}%`);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as (Omit<UdsendelseLogRaekke, "id"> & { id?: string; kilde?: string })[])
        .map((r, i) => ({ ...r, id: r.id ?? `${r.kilde}-${pageParam + i}-${r.tidspunkt}` })) as UdsendelseLogRaekke[];
    },
    getNextPageParam: (last, all) => (last.length < LOG_SIDE ? undefined : all.length * LOG_SIDE),
  });
}

export function useModtagerValg() {
  return useQuery({
    queryKey: ["udsendelser-modtagervalg"],
    queryFn: async () => {
      const [r, t, e] = await Promise.all([
        supabase.from("system_role_definitions").select("key, label").order("label"),
        supabase.from("teams").select("id, name").order("name"),
        supabase.from("employee_master_data").select("id, first_name, last_name").eq("is_active", true).order("first_name"),
      ]);
      if (r.error) throw r.error;
      if (t.error) throw t.error;
      if (e.error) throw e.error;
      return { roller: r.data ?? [], teams: t.data ?? [], medarbejdere: e.data ?? [] };
    },
    staleTime: 5 * 60_000,
  });
}

export interface SendBesked {
  kanal: Kanal; maal: "mig" | "alle" | "roller" | "teams" | "medarbejder"; ids: string[]; emne: string; tekst: string; kunAntal?: boolean;
}

export type SendSvar = { antal: number; sendt?: number; sprunget?: number; fejl?: number; loft?: number };

export interface UdsendelserOverblik {
  brugere_med_login: number; tilmeldte: number; deaktiverede: number; fejl_7_dage: number;
  pr_rolle: { rolle: string | null; tilmeldte: number; i_alt: number }[];
  pr_team: { team: string | null; tilmeldte: number; i_alt: number }[];
  syv_dage: { kanal: string; type: string; sendt: number; fejl: number; sprunget: number }[];
}

/** Overblikstal (kun ejere; RPC returnerer null for andre). */
export function useUdsendelserOverblik() {
  return useQuery({
    queryKey: ["udsendelser-overblik"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("udsendelser_overblik");
      if (error) throw error;
      return (data ?? null) as unknown as UdsendelserOverblik | null;
    },
  });
}

export function useSendBesked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: SendBesked) => {
      const { data, error } = await supabase.functions.invoke("send-besked", { body: b });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Ugyldige felter");
      return data as SendSvar;
    },
    onSuccess: (_d, b) => {
      if (!b.kunAntal) {
        qc.invalidateQueries({ queryKey: [KEY_LOG] });
        qc.invalidateQueries({ queryKey: [KEY_TYPER] });
      }
    },
  });
}

/** Brugerens egne fravalg. Typerne kan kun læses af ejere (RLS); andre får en tom liste. */
export function useMineUdsendelsespraeferencer() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: [KEY_PRAEF, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [t, p] = await Promise.all([
        supabase.from("udsendelsestyper").select("noegle, navn, kanal").eq("aktiv", true).order("navn"),
        supabase.from("udsendelsespraeferencer").select("type_noegle, kanal, aktiv").eq("user_id", user!.id),
      ]);
      if (t.error) throw t.error;
      if (p.error) throw p.error;
      const fra = new Set((p.data ?? []).filter((r) => r.aktiv === false).map((r) => `${r.type_noegle}|${r.kanal}`));
      // Kun typer, brugeren er inden for modtagerreglen på (fejl i tjekket = vis typen).
      const tilladt = await Promise.all((t.data ?? []).map(async (x) => {
        const { data, error } = await supabase.rpc("udsendelse_tilladt", { p_user_id: user!.id, p_type: x.noegle });
        return error ? true : data !== false;
      }));
      return (t.data ?? []).filter((_, i) => tilladt[i]).map((x) => ({ ...x, aktiv: !fra.has(`${x.noegle}|${x.kanal}`) }));
    },
  });
  const saet = useMutation({
    mutationFn: async ({ noegle, kanal, aktiv }: { noegle: string; kanal: string; aktiv: boolean }) => {
      const { error } = await supabase.from("udsendelsespraeferencer").upsert(
        { user_id: user!.id, type_noegle: noegle, kanal, aktiv, opdateret: new Date().toISOString() },
        { onConflict: "user_id,type_noegle,kanal" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY_PRAEF, user?.id] }),
  });
  return { ...query, saet };
}
