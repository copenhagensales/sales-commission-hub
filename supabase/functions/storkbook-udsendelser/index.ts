// Storkbook-udsendelser (S4a). Worker for push-notifikationer efter Messenger-modellen.
// Kun cron (x-pulsen-cron-token, samme hemmelighed som pulsen-milestones). Kræver 24c (udsendelse_version() = '24c').
// Fase 1: kilder → kandidater → udsendelse_reserver + vandmærker. Fase 2: overtag → genvalidér → send → afslut.
// Notifikationer viser aldrig beskedtekst eller kundeoplysninger – kun afsenderens fornavn og et antal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendPushUdfald, type Udfald } from "../_shared/push.ts";
import type { StorkbookType } from "../_shared/pushText.ts";

const lavKlient = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
type Svc = ReturnType<typeof lavKlient>;
type Mention = { t: "e" | "t"; id: string };
type Kandidat = {
  type_noegle: StorkbookType; haendelse: string; kilde_type: "opslag" | "kommentar" | "besked" | "reaktion" | "begivenhed";
  kilde_id: string; post_id: string | null; conversation_id: string | null; event_id: string | null; blok: string | null;
  modtager_employee_id: string; afsender_employee_id: string | null; prioritet: number; metadata: Record<string, unknown>;
};
type Reservation = {
  id: string; type_noegle: StorkbookType; haendelse: string; kilde_type: string; kilde_id: string; post_id: string | null;
  conversation_id: string | null; event_id: string | null; blok: string | null; modtager_employee_id: string;
  afsender_employee_id: string | null; transportforsoeg: number; metadata: Record<string, unknown> | null;
};
type Afslut = { status: "sendt" | "ikke_sendt" | "ukendt" | "udskudt" | "sprunget_over" | "annulleret"; aarsag: string | null; naeste?: string | null; metadata?: Record<string, unknown>; transport?: boolean };
type Klar = { userId: string; title: string; body: string; url: string; tag: string; ttl: number };

const PRIO: Record<StorkbookType, number> = {
  storkbook_omtale: 60, storkbook_svar: 50, storkbook_kommentar: 40, storkbook_ros: 30,
  storkbook_reaktion: 25, storkbook_besked: 20, storkbook_begivenhed: 10,
};
const RAEKKE_LIMIT = 500;
const GRUPPE_LIMIT = 100;
const FASE1_MS = 15_000;
const FASE2_FRIST_MS = 35_000;
const NY_PORTION_MIN_MS = 15_000;
const NY_RAEKKE_MIN_MS = 5_000;
const ABSOLUT_FRIST_MS = 55_000;
const AFSLUT_VINDUE_MS = 10_000;
const GENVALIDERING_MS = 3_000;
const LOG_MS = 3_000;
const TRANSPORT_MS = 24_000;
const SIDE = 1_000;
const IN_MAKS = 100;
const NUL_UUID = "00000000-0000-0000-0000-000000000000";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---------- tid (Europe/Copenhagen) ----------
function dkDele(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d).map((x) => [x.type, x.value]));
  const hh = p.hour === "24" ? "00" : p.hour;
  return { dato: `${p.year}-${p.month}-${p.day}`, hhmm: `${hh}:${p.minute}`, sek: Number(hh) * 3600 + Number(p.minute) * 60 + Number(p.second) };
}
/**
 * Dansk vægur (dato + hh:mm) → UTC. Prøver offset +1 og +2 t og beholder dem, hvor dansk vægur
 * (Intl, Europe/Copenhagen) giver præcis dato/klokkeslæt. Tvetydigt (efterår) eller ikke-eksisterende
 * (forår) klokkeslæt → det senere tidspunkt.
 */
function dkTilUtc(dato: string, hhmm: string): Date {
  const [y, m, d] = dato.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const kandidater = [1, 2].map((o) => Date.UTC(y, m - 1, d, h, mi) - o * 3600_000);
  const passer = kandidater.filter((t) => { const l = dkDele(new Date(t)); return l.dato === dato && l.hhmm === hhmm; });
  return new Date(Math.max(...(passer.length ? passer : kandidater)));
}
function plusDage(dato: string, n: number): string {
  const [y, m, d] = dato.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** Sekunder til 23:59:59 dansk tid (ingen nedre grænse). */
const sekTilDagensSlut = () => 86399 - dkDele().sek;
const omMin = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

// ---------- hjælpere ----------
const s = <T>(q: T, signal: AbortSignal): T => (q as unknown as { abortSignal: (x: AbortSignal) => T }).abortSignal(signal);
function mentionsAf(v: unknown): Mention[] {
  if (!Array.isArray(v)) return [];
  return v.filter((m): m is Mention => !!m && typeof m === "object" && (m.t === "e" || m.t === "t") && typeof m.id === "string");
}
const fornavn = (x: string | null | undefined) => (x ?? "").trim().split(/\s+/)[0]?.slice(0, 30) || "En kollega";

/** Konstant-tid sammenligning af hex-strenge. */
function ensKonstantTid(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let d = a.length ^ b.length;
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/** Deterministisk paginering i blokke à 1.000 (kalderen ordner efter id), indtil en side er kortere. */
async function alleSider<T>(lav: (fra: number, til: number) => PromiseLike<{ data: unknown; error: unknown }>, fejl: () => Error): Promise<T[]> {
  const ud: T[] = [];
  for (let fra = 0; ; fra += SIDE) {
    const { data, error } = await lav(fra, fra + SIDE - 1);
    if (error) throw fejl();
    const rows = (data ?? []) as T[];
    ud.push(...rows);
    if (rows.length < SIDE) return ud;
  }
}
const bidder = <T>(xs: T[], n = IN_MAKS): T[][] => { const ud: T[][] = []; for (let i = 0; i < xs.length; i += n) ud.push(xs.slice(i, i + n)); return ud; };

async function sha256Hex(t: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- fase 1 ----------
type KildeRapport = { kilde: string; raekker: number; kandidater: number; indsat: number; opgraderet: number; afvist_loft: number; stoppet?: string };

async function teamMedlemmer(svc: Svc, teamIds: string[], signal: AbortSignal): Promise<Map<string, string[]>> {
  const m = new Map<string, string[]>();
  if (!teamIds.length) return m;
  for (const del of bidder([...new Set(teamIds)])) {
    const rows = await alleSider<{ team_id: string; employee_id: string }>((fra, til) =>
      s(svc.from("team_members").select("id, team_id, employee_id").in("team_id", del).order("id").range(fra, til), signal), () => new Error("udvidelse"));
    for (const r of rows) m.set(r.team_id, [...(m.get(r.team_id) ?? []), r.employee_id]);
  }
  return m;
}

function omtaleKandidater(mentions: Mention[], hold: Map<string, string[]>, basis: Omit<Kandidat, "type_noegle" | "modtager_employee_id" | "prioritet" | "metadata">): Kandidat[] {
  const ud: Kandidat[] = [];
  for (const m of mentions) {
    const modtagere = m.t === "e" ? [m.id] : hold.get(m.id) ?? [];
    for (const e of modtagere) ud.push({ ...basis, type_noegle: "storkbook_omtale", modtager_employee_id: e, prioritet: PRIO.storkbook_omtale, metadata: { omtale: { t: m.t, id: m.id } } });
  }
  return ud;
}

/** Én kandidat pr. (modtager, hændelse) med højeste prioritet; aldrig til afsenderen selv. */
function grupper(k: Kandidat[]): Kandidat[] {
  const m = new Map<string, Kandidat>();
  for (const c of k) {
    if (!c.modtager_employee_id || c.modtager_employee_id === c.afsender_employee_id) continue;
    const key = `${c.modtager_employee_id}|${c.haendelse}`;
    const f = m.get(key);
    if (!f || c.prioritet > f.prioritet) m.set(key, c);
  }
  return [...m.values()];
}

async function reserver(svc: Svc, rows: Kandidat[], signal: AbortSignal) {
  if (!rows.length) return { indsat: 0, opgraderet: 0, afvist_loft: 0 };
  const { data, error } = await s(svc.rpc("udsendelse_reserver", { p_rows: rows }), signal);
  if (error) throw new Error("reserver");
  const r = (data as { indsat: number; opgraderet: number; afvist_loft: number }[] | null)?.[0];
  return { indsat: r?.indsat ?? 0, opgraderet: r?.opgraderet ?? 0, afvist_loft: r?.afvist_loft ?? 0 };
}

async function flyt(svc: Svc, kilde: string, tid: string | null, id: string | null, blok: string | null, postId: string | null, signal: AbortSignal) {
  const { error } = await s(svc.rpc("udsendelse_vandmaerke_flyt", { p_kilde: kilde, p_tid: tid, p_id: id, p_blok: blok, p_post_id: postId }), signal);
  if (error) throw new Error("vandmaerke");
}

async function vandmaerke(svc: Svc, kilde: string, signal: AbortSignal) {
  const { data, error } = await s(svc.from("udsendelse_vandmaerker").select("tid, id, blok, post_id").eq("kilde", kilde), signal).maybeSingle();
  if (error || !data) throw new Error("vandmaerke");
  return data as { tid: string | null; id: string | null; blok: string | null; post_id: string | null };
}

/** Kører én tid/id-kilde side for side. */
async function koerTidKilde(
  svc: Svc, kilde: "opslag" | "kommentarer" | "beskeder", rpc: string, dry: boolean, frist: number, signal: AbortSignal,
  udvid: (rows: Record<string, unknown>[]) => Promise<Kandidat[]>, tael: (k: Kandidat[]) => void,
): Promise<KildeRapport> {
  const rap: KildeRapport = { kilde, raekker: 0, kandidater: 0, indsat: 0, opgraderet: 0, afvist_loft: 0 };
  try {
    const v = await vandmaerke(svc, kilde, signal);
    let tid = v.tid ?? "1970-01-01T00:00:00Z";
    let id = v.id ?? NUL_UUID;
    while (Date.now() < frist) {
      const { data, error } = await s(svc.rpc(rpc, { p_tid: tid, p_id: id, p_limit: RAEKKE_LIMIT }), signal);
      if (error) throw new Error("kilde");
      const rows = (data ?? []) as Record<string, unknown>[];
      rap.raekker += rows.length;
      if (!rows.length) break;
      // Fejler udvidelsen, stopper kilden, og vandmærket flyttes ikke forbi siden.
      const k = grupper(await udvid(rows));
      rap.kandidater += k.length;
      tael(k);
      const sidste = rows[rows.length - 1];
      if (!dry) {
        const r = await reserver(svc, k, signal);
        rap.indsat += r.indsat; rap.opgraderet += r.opgraderet; rap.afvist_loft += r.afvist_loft;
        await flyt(svc, kilde, String(sidste.tid), String(sidste.id), null, null, signal);
      }
      tid = String(sidste.tid); id = String(sidste.id);
      if (rows.length < RAEKKE_LIMIT) break;
    }
  } catch (e) {
    rap.stoppet = (e as Error)?.name === "AbortError" ? "frist" : (e as Error)?.message ?? "fejl";
  }
  return rap;
}

async function fase1(svc: Svc, dry: boolean, start: number, hoved: AbortSignal) {
  const frist = start + FASE1_MS;
  // Hvert kald i fase 1 afbrydes senest ved sekund 15.
  const signal = AbortSignal.any([hoved, AbortSignal.timeout(Math.max(1, frist - Date.now()))]);
  const tael: Record<string, number> = {};
  const t = (k: Kandidat[]) => { for (const c of k) tael[c.type_noegle] = (tael[c.type_noegle] ?? 0) + 1; };
  const rapporter: KildeRapport[] = [];

  rapporter.push(await koerTidKilde(svc, "opslag", "udsendelse_kilde_opslag", dry, frist, signal, async (rows) => {
    const teams = rows.flatMap((r) => mentionsAf(r.mentions).filter((m) => m.t === "t").map((m) => m.id));
    const hold = await teamMedlemmer(svc, teams, signal);
    const ud: Kandidat[] = [];
    for (const r of rows) {
      if (r.deleted_at || r.hidden_at) continue;
      const postId = String(r.id);
      const basis = { haendelse: `opslag:${postId}`, kilde_type: "opslag" as const, kilde_id: postId, post_id: postId, conversation_id: null, event_id: null, blok: null, afsender_employee_id: String(r.author_employee_id) };
      if (r.post_type === "praise") {
        for (const e of (r.praised_employee_ids as string[] | null) ?? []) ud.push({ ...basis, type_noegle: "storkbook_ros", modtager_employee_id: e, prioritet: PRIO.storkbook_ros, metadata: {} });
      }
      ud.push(...omtaleKandidater(mentionsAf(r.mentions), hold, basis));
    }
    return ud;
  }, t));

  rapporter.push(await koerTidKilde(svc, "kommentarer", "udsendelse_kilde_kommentarer", dry, frist, signal, async (rows) => {
    const teams = rows.flatMap((r) => mentionsAf(r.mentions).filter((m) => m.t === "t").map((m) => m.id));
    const hold = await teamMedlemmer(svc, teams, signal);
    const ud: Kandidat[] = [];
    for (const r of rows) {
      if (r.post_deleted_at || r.post_hidden_at || !r.kommentator_employee_id) continue;
      const cid = String(r.id);
      const postId = String(r.post_id);
      const basis = { haendelse: `kommentar:${cid}`, kilde_type: "kommentar" as const, kilde_id: cid, post_id: postId, conversation_id: null, event_id: null, blok: null, afsender_employee_id: String(r.kommentator_employee_id) };
      const svar = r.post_type === "question";
      const type: StorkbookType = svar ? "storkbook_svar" : "storkbook_kommentar";
      if (r.post_author) ud.push({ ...basis, type_noegle: type, modtager_employee_id: String(r.post_author), prioritet: PRIO[type], metadata: {} });
      ud.push(...omtaleKandidater(mentionsAf(r.mentions), hold, basis));
    }
    return ud;
  }, t));

  rapporter.push(await koerTidKilde(svc, "beskeder", "udsendelse_kilde_beskeder", dry, frist, signal, async (rows) => {
    const konv = [...new Set(rows.map((r) => String(r.conversation_id)))];
    const med = new Map<string, string[]>();
    const alle: { conversation_id: string; employee_id: string }[] = [];
    for (const del of bidder(konv)) {
      alle.push(...await alleSider<{ conversation_id: string; employee_id: string }>((fra, til) =>
        s(svc.from("chat_conversation_members").select("id, conversation_id, employee_id").in("conversation_id", del).order("id").range(fra, til), signal), () => new Error("udvidelse")));
    }
    for (const m of alle) med.set(m.conversation_id, [...(med.get(m.conversation_id) ?? []), m.employee_id]);
    const ud: Kandidat[] = [];
    for (const r of rows) {
      if (r.deleted_at) continue;
      const id = String(r.id);
      for (const e of med.get(String(r.conversation_id)) ?? []) {
        ud.push({ type_noegle: "storkbook_besked", haendelse: `besked:${id}`, kilde_type: "besked", kilde_id: id, post_id: null, conversation_id: String(r.conversation_id), event_id: null, blok: null, modtager_employee_id: e, afsender_employee_id: String(r.sender_id), prioritet: PRIO.storkbook_besked, metadata: {} });
      }
    }
    return ud;
  }, t));

  // Reaktioner: vandmærke = sidste behandlede gruppe (blok, post_id).
  const rr: KildeRapport = { kilde: "reaktioner", raekker: 0, kandidater: 0, indsat: 0, opgraderet: 0, afvist_loft: 0 };
  try {
    const v = await vandmaerke(svc, "reaktioner", signal);
    let blok = v.blok ?? "0000-00-00T00";
    let postId: string | null = v.post_id;
    while (Date.now() < frist) {
      const { data, error } = await s(svc.rpc("udsendelse_kilde_reaktioner", { p_blok: blok, p_post_id: postId, p_limit: GRUPPE_LIMIT }), signal);
      if (error) throw new Error("kilde");
      const rows = (data ?? []) as { blok: string; post_id: string; author_employee_id: string; foerste_reaktor: string; antal: number }[];
      rr.raekker += rows.length;
      if (!rows.length) break;
      const k = grupper(rows.map((g) => ({
        type_noegle: "storkbook_reaktion", haendelse: `reaktion:${g.post_id}:${g.blok}`, kilde_type: "reaktion", kilde_id: g.post_id, post_id: g.post_id,
        conversation_id: null, event_id: null, blok: g.blok, modtager_employee_id: g.author_employee_id, afsender_employee_id: g.foerste_reaktor,
        prioritet: PRIO.storkbook_reaktion, metadata: { antal: g.antal },
      })));
      rr.kandidater += k.length; t(k);
      const sidste = rows[rows.length - 1];
      if (!dry) {
        const r = await reserver(svc, k, signal);
        rr.indsat += r.indsat; rr.opgraderet += r.opgraderet; rr.afvist_loft += r.afvist_loft;
        await flyt(svc, "reaktioner", null, null, sidste.blok, sidste.post_id, signal);
      }
      blok = sidste.blok; postId = sidste.post_id;
      if (rows.length < GRUPPE_LIMIT) break;
    }
  } catch (e) {
    rr.stoppet = (e as Error)?.name === "AbortError" ? "frist" : (e as Error)?.message ?? "fejl";
  }
  rapporter.push(rr);

  // Begivenheder: kun dansk 17:00–23:59; intet vandmærke (unik nøgle afgør).
  const br: KildeRapport = { kilde: "begivenheder", raekker: 0, kandidater: 0, indsat: 0, opgraderet: 0, afvist_loft: 0 };
  const nu = dkDele();
  if (nu.hhmm >= "17:00" && Date.now() < frist) {
    try {
      const rows = await alleSider<{ event_id: string; event_date: string; employee_id: string }>((fra, til) =>
        s(svc.rpc("udsendelse_kilde_begivenheder", { p_dato: nu.dato }).order("event_id").order("employee_id").range(fra, til), signal), () => new Error("kilde"));
      br.raekker = rows.length;
      const k = grupper(rows.map((r) => ({
        type_noegle: "storkbook_begivenhed", haendelse: `begivenhed:${r.event_id}:${r.event_date}`, kilde_type: "begivenhed", kilde_id: r.event_id,
        post_id: null, conversation_id: null, event_id: r.event_id, blok: null, modtager_employee_id: r.employee_id, afsender_employee_id: null,
        prioritet: PRIO.storkbook_begivenhed, metadata: {},
      })));
      br.kandidater = k.length; t(k);
      if (!dry) { const r = await reserver(svc, k, signal); br.indsat = r.indsat; br.opgraderet = r.opgraderet; br.afvist_loft = r.afvist_loft; }
    } catch (e) {
      br.stoppet = (e as Error)?.name === "AbortError" ? "frist" : (e as Error)?.message ?? "fejl";
    }
  } else br.stoppet = "uden for 17-24";
  rapporter.push(br);
  return { kilder: rapporter, kandidater_pr_type: tael };
}

// ---------- fase 2: genvalidering ----------
class DbFejl extends Error {}
const db = <T extends { error: unknown }>(r: T): T => { if (r.error) throw new DbFejl("db"); return r; };

async function navn(svc: Svc, employeeId: string | null, signal: AbortSignal) {
  if (!employeeId) return "En kollega";
  const { data } = db(await s(svc.from("employee_master_data").select("first_name").eq("id", employeeId), signal).maybeSingle());
  return fornavn((data as { first_name: string | null } | null)?.first_name);
}

async function omtaleGrundlag(svc: Svc, mentions: Mention[], modtager: string, signal: AbortSignal): Promise<"dig" | "team" | null> {
  if (mentions.some((m) => m.t === "e" && m.id === modtager)) return "dig";
  const teams = mentions.filter((m) => m.t === "t").map((m) => m.id);
  if (!teams.length) return null;
  const { count } = db(await s(svc.from("team_members").select("id", { count: "exact", head: true }).eq("employee_id", modtager).in("team_id", teams), signal));
  return (count ?? 0) > 0 ? "team" : null;
}

type Post = { id: string; author_employee_id: string; audience: string; team_id: string | null; deleted_at: string | null; hidden_at: string | null; praised_employee_ids: string[] | null; mentions: unknown; post_type: string };
async function hentSynligtOpslag(svc: Svc, postId: string, modtager: string, signal: AbortSignal): Promise<Post | Afslut> {
  const { data } = db(await s(svc.from("pulsen_posts").select("id, author_employee_id, audience, team_id, deleted_at, hidden_at, praised_employee_ids, mentions, post_type").eq("id", postId), signal).maybeSingle());
  const p = data as Post | null;
  if (!p || p.deleted_at || p.hidden_at) return { status: "annulleret", aarsag: "kilde væk" };
  const { data: ok } = db(await s(svc.rpc("pulsen_kan_se_opslag", { p_employee: modtager, p_audience: p.audience, p_team_id: p.team_id, p_author: p.author_employee_id, p_deleted_at: p.deleted_at, p_hidden_at: p.hidden_at }), signal));
  if (ok !== true) return { status: "annulleret", aarsag: "ikke synlig" };
  return p;
}
const erAfslut = (x: unknown): x is Afslut => !!x && typeof x === "object" && "status" in x;

async function genvalider(svc: Svc, r: Reservation, signal: AbortSignal): Promise<Afslut | Omit<Klar, "userId">> {
  const modtager = r.modtager_employee_id;
  const opslagUrl = (id: string) => `/storkbook/indlaeg/${id}`;
  const dag = 86400;
  switch (r.type_noegle) {
    case "storkbook_ros": {
      const p = await hentSynligtOpslag(svc, r.post_id ?? r.kilde_id, modtager, signal);
      if (erAfslut(p)) return p;
      if (!(p.praised_employee_ids ?? []).includes(modtager)) return { status: "annulleret", aarsag: "ikke rost" };
      return { title: "Ros", body: `${await navn(svc, r.afsender_employee_id, signal)} gav dig ros`, url: opslagUrl(p.id), tag: `opslag:${p.id}`, ttl: dag };
    }
    case "storkbook_svar":
    case "storkbook_kommentar":
    case "storkbook_omtale": {
      const p = await hentSynligtOpslag(svc, r.post_id ?? "", modtager, signal);
      if (erAfslut(p)) return p;
      let mentions: unknown = p.mentions;
      if (r.kilde_type === "kommentar") {
        const { data: c } = db(await s(svc.from("feed_comments").select("id, mentions").eq("id", r.kilde_id), signal).maybeSingle());
        if (!c) return { status: "annulleret", aarsag: "kilde væk" };
        mentions = (c as { mentions: unknown }).mentions;
      }
      const hvem = await navn(svc, r.afsender_employee_id, signal);
      const tag = `opslag:${p.id}`;
      if (r.type_noegle === "storkbook_omtale") {
        const g = await omtaleGrundlag(svc, mentionsAf(mentions), modtager, signal);
        if (!g) return { status: "annulleret", aarsag: "ikke omtalt" };
        return { title: "Omtale", body: g === "dig" ? `${hvem} nævnte dig` : `${hvem} nævnte dit team`, url: opslagUrl(p.id), tag, ttl: dag };
      }
      if (p.author_employee_id !== modtager) return { status: "annulleret", aarsag: "ikke forfatter" };
      return r.type_noegle === "storkbook_svar"
        ? { title: "Svar", body: `${hvem} svarede på dit spørgsmål`, url: opslagUrl(p.id), tag, ttl: dag }
        : { title: "Kommentar", body: `${hvem} kommenterede dit opslag`, url: opslagUrl(p.id), tag, ttl: dag };
    }
    case "storkbook_besked": {
      const { data: m } = db(await s(svc.from("chat_messages").select("id, conversation_id, sender_id, deleted_at").eq("id", r.kilde_id), signal).maybeSingle());
      const msg = m as { id: string; conversation_id: string; sender_id: string; deleted_at: string | null } | null;
      if (!msg || msg.deleted_at) return { status: "annulleret", aarsag: "kilde væk" };
      const { data: mem } = db(await s(svc.from("chat_conversation_members").select("aktiv_til").eq("conversation_id", msg.conversation_id).eq("employee_id", modtager), signal).maybeSingle());
      if (!mem) return { status: "annulleret", aarsag: "ikke medlem" };
      const { count: laest } = db(await s(svc.from("chat_message_read_receipts").select("id", { count: "exact", head: true }).eq("message_id", msg.id).eq("employee_id", modtager), signal));
      if ((laest ?? 0) > 0) return { status: "sprunget_over", aarsag: "læst" };
      const aktivTil = (mem as { aktiv_til: string | null }).aktiv_til;
      if (aktivTil && new Date(aktivTil).getTime() > Date.now()) {
        return { status: "udskudt", aarsag: "aktiv", naeste: new Date(new Date(aktivTil).getTime() + 15_000).toISOString() };
      }
      // Ulæste = alle beskeder fra andre i samtalen \ modtagerens kvitteringer i samtalen (pagineret, ingen id-lister).
      const dbFejl = () => new DbFejl("db");
      const kvitteret = new Set((await alleSider<{ message_id: string }>((fra, til) =>
        s(svc.from("chat_message_read_receipts").select("message_id, chat_messages!inner(conversation_id)").eq("employee_id", modtager)
          .eq("chat_messages.conversation_id", msg.conversation_id).order("message_id").range(fra, til), signal), dbFejl)).map((x) => x.message_id));
      const andre = await alleSider<{ id: string }>((fra, til) =>
        s(svc.from("chat_messages").select("id").eq("conversation_id", msg.conversation_id).neq("sender_id", modtager).is("deleted_at", null).order("id").range(fra, til), signal), dbFejl);
      const n = Math.max(1, andre.filter((x) => !kvitteret.has(x.id)).length);
      const body = n > 1 ? `${n} nye beskeder` : `${await navn(svc, msg.sender_id, signal)} har skrevet til dig`;
      return { title: "Ny besked", body, url: `/storkbook?tab=beskeder&samtale=${msg.conversation_id}`, tag: `samtale:${msg.conversation_id}`, ttl: 21600 };
    }
    case "storkbook_reaktion": {
      const postId = r.post_id ?? r.kilde_id;
      const p = await hentSynligtOpslag(svc, postId, modtager, signal);
      if (erAfslut(p)) return p;
      if (!r.blok) return { status: "annulleret", aarsag: "kilde væk" };
      const fra = new Date(`${r.blok}:00:00Z`);
      const til = new Date(fra.getTime() + 3600_000);
      const { data: re } = db(await s(svc.from("feed_reactions").select("user_id, created_at").eq("target_type", "pulsen_post").eq("target_key", `pulsen_post:${postId}`)
        .gte("created_at", fra.toISOString()).lt("created_at", til.toISOString()).order("created_at", { ascending: true }), signal));
      const users = [...new Set(((re ?? []) as { user_id: string }[]).map((x) => x.user_id))];
      let reaktorer: string[] = [];
      if (users.length) {
        const { data: em } = db(await s(svc.from("employee_master_data").select("id, auth_user_id").in("auth_user_id", users), signal));
        const map = new Map(((em ?? []) as { id: string; auth_user_id: string }[]).map((x) => [x.auth_user_id, x.id]));
        reaktorer = users.map((u) => map.get(u)).filter((x): x is string => !!x && x !== modtager);
        reaktorer = [...new Set(reaktorer)];
      }
      if (!reaktorer.length) return { status: "annulleret", aarsag: "ingen reaktioner" };
      const hvem = await navn(svc, reaktorer[0], signal);
      const n = reaktorer.length - 1;
      return { title: "Reaktion", body: n > 0 ? `${hvem} og ${n} andre reagerede på dit opslag` : `${hvem} reagerede på dit opslag`, url: opslagUrl(postId), tag: `opslag:${postId}`, ttl: dag };
    }
    case "storkbook_begivenhed": {
      const eventId = r.event_id ?? r.kilde_id;
      const noegleDato = r.haendelse.split(":")[2] ?? "";
      const { data: ev } = db(await s(svc.from("company_events").select("id, event_date, event_time").eq("id", eventId), signal).maybeSingle());
      const e = ev as { id: string; event_date: string; event_time: string | null } | null;
      if (!e || e.event_date !== noegleDato) return { status: "annulleret", aarsag: "kilde væk" };
      if (dkDele().dato !== plusDage(e.event_date, -1)) return { status: "annulleret", aarsag: "udløbet" };
      const { data: att } = db(await s(svc.from("event_attendees").select("status").eq("event_id", eventId).eq("employee_id", modtager), signal).maybeSingle());
      const st = (att as { status: string } | null)?.status;
      if (st !== "attending" && st !== "maybe") return { status: "annulleret", aarsag: "ikke deltager" };
      const { data: inv } = db(await s(svc.from("event_team_invitations").select("team_id").eq("event_id", eventId), signal));
      const teams = ((inv ?? []) as { team_id: string }[]).map((x) => x.team_id);
      if (teams.length) {
        const { count } = db(await s(svc.from("team_members").select("id", { count: "exact", head: true }).eq("employee_id", modtager).in("team_id", teams), signal));
        if (!(count ?? 0)) return { status: "annulleret", aarsag: "ikke inviteret" };
      }
      const kl = e.event_time ? e.event_time.slice(0, 5) : null;
      return { title: "Begivenhed i morgen", body: kl ? `Begivenhed i morgen kl. ${kl}` : "Begivenhed i morgen", url: `/storkbook/begivenhed/${eventId}`, tag: `begivenhed:${eventId}`, ttl: sekTilDagensSlut() };
    }
  }
  return { status: "annulleret", aarsag: "ukendt type" };
}

function iStille(fra: string | null, til: string | null, nu: string) {
  if (!fra || !til) return false;
  const f = fra.slice(0, 5), t = til.slice(0, 5);
  return f <= t ? nu >= f && nu < t : nu >= f || nu < t;
}

/** Forbereder: genvalidering, bruger, fravalg, stille timer. Alt inden for 3 s. */
async function forbered(svc: Svc, r: Reservation, signal: AbortSignal): Promise<Afslut | Klar> {
  const v = await genvalider(svc, r, signal);
  if (erAfslut(v)) return v;
  const { data: em } = db(await s(svc.from("employee_master_data").select("auth_user_id").eq("id", r.modtager_employee_id), signal).maybeSingle());
  const userId = (em as { auth_user_id: string | null } | null)?.auth_user_id;
  if (!userId) return { status: "sprunget_over", aarsag: "ingen bruger" };
  const pr = await s(svc.from("udsendelsespraeferencer").select("aktiv").eq("user_id", userId).eq("type_noegle", r.type_noegle).eq("kanal", "push"), signal).maybeSingle();
  if (pr.error) return { status: "ikke_sendt", aarsag: "præferencefejl", naeste: omMin(2), transport: false };
  if ((pr.data as { aktiv: boolean } | null)?.aktiv === false) return { status: "sprunget_over", aarsag: "fravalgt" };
  const { data: ty } = db(await s(svc.from("udsendelsestyper").select("stille_fra, stille_til").eq("noegle", r.type_noegle), signal).maybeSingle());
  const t = ty as { stille_fra: string | null; stille_til: string | null } | null;
  const nu = dkDele();
  if (t && iStille(t.stille_fra, t.stille_til, nu.hhmm)) {
    const slut = t.stille_til!.slice(0, 5);
    const dato = slut > nu.hhmm ? nu.dato : plusDage(nu.dato, 1);
    const t2 = dkTilUtc(dato, slut);
    // Aldrig udskudt til fortiden.
    return { status: "udskudt", aarsag: "stille_timer", naeste: t2.getTime() > Date.now() ? t2.toISOString() : omMin(15) };
  }
  return { userId, ...v };
}

function fejlkodeAf(u: Udfald): string | undefined {
  if (u.aarsag === "vapid_mangler" || u.aarsag === "payload") return u.aarsag;
  if (u.status === "fejl") return "db";
  const a = u.abonnementer.find((x) => x.status !== "sendt");
  if (!a) return undefined;
  return a.kode !== null ? `http_${a.kode}` : "netvaerk";
}

function udfaldTilAfslut(u: Udfald, forsoeg: number): Afslut {
  const meta: Record<string, unknown> = { abonnementer: u.abonnementer };
  const fk = fejlkodeAf(u);
  if (fk && u.status !== "sendt" && u.status !== "allerede_sendt") meta.fejlkode = fk;
  switch (u.status) {
    case "sendt": case "allerede_sendt": return { status: "sendt", aarsag: u.status === "allerede_sendt" ? "allerede_sendt" : null, metadata: meta, transport: u.transportForsoegt };
    case "ikke_sendt": return { status: "ikke_sendt", aarsag: fk ?? "ikke_sendt", naeste: omMin(2 ** (forsoeg + 1)), metadata: meta, transport: u.transportForsoegt };
    case "ukendt": return { status: "ukendt", aarsag: fk ?? "ukendt", metadata: meta, transport: u.transportForsoegt };
    case "stille_timer": return { status: "udskudt", aarsag: "stille_timer", naeste: omMin(15), metadata: meta, transport: false };
    case "fejl": return { status: "ikke_sendt", aarsag: fk ?? "db", naeste: omMin(2), metadata: meta, transport: u.transportForsoegt };
    default: return { status: "sprunget_over", aarsag: u.status, metadata: meta, transport: u.transportForsoegt };
  }
}

async function afslut(svc: Svc, id: string, token: string, a: Afslut, signal: AbortSignal): Promise<boolean> {
  const { data, error } = await s(svc.rpc("udsendelse_afslut", {
    p_id: id, p_token: token, p_status: a.status, p_aarsag: a.aarsag, p_naeste: a.naeste ?? null, p_metadata: a.metadata ?? {}, p_transport_forsoeg: !!a.transport,
  }), signal);
  if (error || data !== true) { console.error("storkbook-udsendelser: afslut fejlede", error ? "db" : "ejerskab"); return false; }
  return true;
}

async function frigivRaekker(svc: Svc, token: string, ids: string[], signal: AbortSignal): Promise<boolean> {
  if (!ids.length) return true;
  const fr = await s(svc.rpc("udsendelse_frigiv_raekker", { p_token: token, p_ids: ids }), signal).then((x) => x, () => ({ error: "afbrudt" }));
  if (fr.error) { console.error("storkbook-udsendelser: frigiv_raekker fejlede"); return false; }
  return true;
}

// ---------- server ----------
type Ejet = { transport: boolean; afslut?: Afslut };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const start = Date.now();
  // Absolut frist fra start – gælder alle kald, også token- og versionsopslag.
  const hoved = new AbortController();
  const hovedTimer = setTimeout(() => hoved.abort(), ABSOLUT_FRIST_MS);
  const svc = lavKlient();
  try {
    // Adgang: kun cron-token (også dry_run).
    const hdr = req.headers.get("x-pulsen-cron-token") ?? "";
    if (!hdr) return json({ error: "Ingen adgang" }, 403);
    const { data: cfg, error: cfgErr } = await s(svc.from("pulsen_config").select("value").eq("key", "cron_token_sha256"), hoved.signal).maybeSingle();
    if (cfgErr) return json({ error: "Konfiguration kunne ikke læses" }, 500);
    const forventet = (cfg as { value: unknown } | null)?.value;
    if (typeof forventet !== "string" || !ensKonstantTid(await sha256Hex(hdr), forventet)) return json({ error: "Ingen adgang" }, 403);

    // (1) body
    const body = await req.json().catch(() => ({}));
    const dry = body?.dry_run === true;

    // (2) 24c skal være installeret
    const ver = await s(svc.rpc("udsendelse_version"), hoved.signal);
    if (ver.error || ver.data !== "24c") return json({ error: "24c mangler" }, 503);

    // (3) dry_run: skrivefri rapport
    if (dry) return json({ dry_run: true, ...(await fase1(svc, true, start, hoved.signal)) });

    // (4) lås – inde i try/finally, så frigiv(token) altid kaldes.
    const token = crypto.randomUUID();
    const rapport: Record<string, unknown> = {};
    const optalt: Record<string, number> = {};
    // Lokalt ejerskab: overtagne rækker med transportflag, indtil afslut lykkes eller rækken er frigivet.
    const ejede = new Map<string, Ejet>();
    let fikLaas = false;
    let frigivet = 0;
    try {
      const laas = await s(svc.rpc("udsendelse_laas", { p_token: token }), hoved.signal);
      fikLaas = !laas.error && laas.data === true;
      if (!fikLaas) rapport.sprunget_over = laas.error ? "lås-fejl" : "anden kørsel";
      if (fikLaas) {
        // (5) oprydning
        const op = await s(svc.rpc("udsendelse_oprydning"), hoved.signal);
        rapport.oprydning = op.error ? "fejl" : op.data;
        // (6) fase 1
        rapport.fase1 = await fase1(svc, false, start, hoved.signal);
        // (7) fase 2
        const frist2 = start + FASE2_FRIST_MS;
        let stop = false;
        while (!stop && frist2 - Date.now() >= NY_PORTION_MIN_MS && !hoved.signal.aborted) {
          const { data, error } = await s(svc.rpc("udsendelse_overtag", { p_token: token, p_limit: 5 }), hoved.signal);
          if (error) { rapport.overtag = "fejl"; break; }
          const rows = (data ?? []) as Reservation[];
          if (!rows.length) break;
          for (const r of rows) ejede.set(r.id, { transport: false });
          for (const r of rows) {
            if (frist2 - Date.now() < NY_RAEKKE_MIN_MS || hoved.signal.aborted) { stop = true; break; }
            const ejet = ejede.get(r.id)!;
            // Budgetter pr. modtager: genvalidering + opslag ≤ 3 s, transport ≤ 24 s, logning + afslut ≤ 3 s.
            const gv = AbortSignal.any([hoved.signal, AbortSignal.timeout(GENVALIDERING_MS)]);
            let tSig: AbortSignal | null = null;
            let lSig: AbortSignal | null = null;
            const logSig = () => (lSig ??= AbortSignal.any([hoved.signal, AbortSignal.timeout(LOG_MS)]));
            let a: Afslut = { status: "ukendt", aarsag: null };
            let klar: Klar | null = null;
            try {
              const f = await forbered(svc, r, gv);
              if (erAfslut(f)) a = f; else klar = f;
            } catch (e) {
              if (hoved.signal.aborted) throw e;
              a = { status: "ikke_sendt", aarsag: e instanceof DbFejl ? "db-fejl" : "db-timeout", naeste: omMin(2), transport: false };
            }
            if (klar && r.type_noegle === "storkbook_begivenhed") {
              // TTL til 23:59:59 dansk tid, beregnet umiddelbart før transport.
              const ttl = sekTilDagensSlut();
              if (ttl <= 0) { a = { status: "annulleret", aarsag: "udløbet", transport: false }; klar = null; }
              else klar.ttl = ttl;
            }
            if (klar) {
              const res = await sendPushUdfald(svc, [klar.userId], r.type_noegle, {
                udsendType: r.type_noegle, tag: klar.tag, renotify: true, url: klar.url, tekst: { title: klar.title, body: klar.body },
                ttlSekunder: klar.ttl, afsenderfunktion: "storkbook-udsendelser", dedupeKey: r.haendelse, signal: hoved.signal, maksAbonnementer: 3,
                faser: {
                  opslag: gv,
                  transport: () => (tSig ??= AbortSignal.any([hoved.signal, AbortSignal.timeout(TRANSPORT_MS)])),
                  log: logSig,
                },
                paaTransportStart: () => { ejet.transport = true; },
              });
              a = udfaldTilAfslut(res.udfald[klar.userId] ?? { status: "fejl", aarsag: "db", transportForsoegt: false, abonnementer: [] }, r.transportforsoeg ?? 0);
            }
            ejet.afslut = a;
            if (hoved.signal.aborted) break;
            const ok = await afslut(svc, r.id, token, a, logSig());
            if (ok) {
              ejede.delete(r.id);
              optalt[a.status] = (optalt[a.status] ?? 0) + 1;
            } else {
              optalt.afslut_fejl = (optalt.afslut_fejl ?? 0) + 1;
              // Uden transport frigives rækken straks; med transport forbliver den ejet (→ vindue / opgivet ved oprydning).
              if (!ejet.transport && await frigivRaekker(svc, token, [r.id], logSig())) { ejede.delete(r.id); frigivet++; }
            }
          }
        }
      }
    } catch (e) {
      if (!hoved.signal.aborted) console.error("storkbook-udsendelser: kørsel fejlede", (e as Error)?.message ?? "fejl");
    } finally {
      clearTimeout(hovedTimer);
      // Afslutningsvindue (≤ 10 s, egen frist).
      const slut = AbortSignal.timeout(AFSLUT_VINDUE_MS);
      // Afstem ejede rækker mod DB (dækker tabt svar fra udsendelse_overtag); fejler opslaget, bruges lokal liste.
      let ids = [...ejede.keys()];
      const afst = await s(svc.from("udsendelse_reservationer").select("id, transportforsoeg").eq("worker_token", token).eq("status", "sender"), slut)
        .then((x) => x, () => ({ data: null, error: "afbrudt" }));
      if (!afst.error && Array.isArray(afst.data)) ids = (afst.data as { id: string }[]).map((x) => x.id);
      else if (fikLaas) console.error("storkbook-udsendelser: afstemning fejlede");
      const frigiv: string[] = [];
      for (const id of ids) {
        const e = ejede.get(id);
        if (e?.transport) {
          const a: Afslut = e.afslut && e.afslut.transport ? e.afslut : { status: "ukendt", aarsag: "frist", transport: true };
          await afslut(svc, id, token, a, slut).catch(() => false);
        } else frigiv.push(id);
      }
      if (frigiv.length && await frigivRaekker(svc, token, frigiv, slut)) frigivet += frigiv.length;
      const fl = await s(svc.rpc("udsendelse_frigiv", { p_token: token }), slut).then((x) => x, () => ({ error: "afbrudt" }));
      if (fl.error) console.error("storkbook-udsendelser: frigiv fejlede");
    }
    return json({ ok: true, ...rapport, fase2: optalt, frigivet, varighed_ms: Date.now() - start });
  } catch (e) {
    return json({ error: (e as Error)?.name === "AbortError" ? "frist" : e instanceof Error ? e.message : "Fejl" }, 500);
  } finally {
    clearTimeout(hovedTimer);
  }
});
