// deno-lint-ignore-file no-explicit-any
/**
 * Fælles port for alt, Stork sender ud (mail, SMS, push).
 * FAIL-OPEN for mail/SMS: fejler opslag eller logning, sendes alligevel (fejl til konsollen).
 * Push er FAIL-CLOSED i forgates: type-, regel- og præferencefejl samt ukendt type giver "fejl".
 * Kun eksplicit `aktiv = false` på typen eller eksplicit fravalg stopper.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Kanal = "mail" | "sms" | "push";
export type UdsendStatus = "sendt" | "fejl" | "slaaet_fra" | "fravalgt" | "stille_timer" | "ingen_tilmelding" | "udenfor_regel" | "ukendt" | "ikke_sendt" | "allerede_sendt";

export interface Modtager {
  modtager: string;
  modtagerEmployeeId?: string;
  modtagerCandidateId?: string;
  modtagerUserId?: string;
}

interface Faelles {
  type: string;
  kanal: Kanal;
  emne?: string;
  afsenderfunktion: string;
  metadata?: Record<string, unknown>;
  /** Afbryder alle databasekald (worker-frist). */
  signal?: AbortSignal;
  /** Frist for logning efter afsendelse (worker). Ellers bruges `signal`. */
  logSignal?: () => AbortSignal;
  /** Snævert flag: kun typen storkbook_tjek må springe udsendelser-loggen over (også i fejl-/gategrene). */
  udenUdsendelseslog?: "storkbook_tjek";
}

export interface Udsendelse extends Faelles, Modtager {
  /** Selve afsendelsen. Må returnere status "ingen_tilmelding"/"fravalgt" (push), så det logges. */
  send: () => Promise<{ reference?: string; status?: UdsendStatus; metadata?: Record<string, unknown>; fejl?: string } | void>;
}

let client: any = null;
function svc(): any {
  if (!client) client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return client;
}

const sig = <T>(u: Faelles, q: T): T => (u.signal ? (q as any).abortSignal(u.signal) : q);

function nuDansk(): string {
  return new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date()).replace(".", ":");
}

function iStilleTimer(fra: string | null, til: string | null): boolean {
  if (!fra || !til) return false;
  const nu = nuDansk();
  const f = fra.slice(0, 5), t = til.slice(0, 5);
  return f <= t ? nu >= f && nu < t : nu >= f || nu < t;
}

/** Afgør om en type/kanal må sende nu. Returnerer null = send. */
async function typeGate(u: Faelles, obl?: { v: boolean }): Promise<"slaaet_fra" | "stille_timer" | "fejl" | null> {
  try {
    const { data, error } = await sig(u, svc().from("udsendelsestyper")
      .select("aktiv, stille_fra, stille_til, obligatorisk").eq("noegle", u.type)).maybeSingle();
    if (error) throw error;
    // Push er fail-closed: ukendt type oprettes ikke og sendes ikke.
    if (!data && u.kanal === "push") return "fejl";
    if (!data) {
      const { error: insErr } = await svc().from("udsendelsestyper").upsert(
        { noegle: u.type, navn: u.type, kanal: u.kanal, udloeser: "handling", afsenderfunktion: u.afsenderfunktion },
        { onConflict: "noegle", ignoreDuplicates: true },
      );
      if (insErr) console.error("udsend: kunne ikke oprette type", u.type, insErr.message);
      return null;
    }
    if (data.aktiv === false) return "slaaet_fra";
    // obligatorisk=true springer præferencer og stille timer over; aktiv, regler og fejlpolitik gælder stadig.
    if (data.obligatorisk === true) { if (obl) obl.v = true; return null; }
    if (u.kanal === "push" && iStilleTimer(data.stille_fra, data.stille_til)) return "stille_timer";
    return null;
  } catch (e) {
    console.error("udsend: typeopslag fejlede", u.type, e instanceof Error ? e.message : e);
    return u.kanal === "push" ? "fejl" : null;
  }
}

async function fravalgt(u: Faelles, userId?: string): Promise<boolean | "fejl"> {
  if (!userId) return false;
  try {
    const { data, error } = await sig(u, svc().from("udsendelsespraeferencer")
      .select("aktiv").eq("user_id", userId).eq("type_noegle", u.type).eq("kanal", u.kanal)).maybeSingle();
    if (error) throw error;
    return data?.aktiv === false;
  } catch (e) {
    console.error("udsend: præferenceopslag fejlede", u.type, e instanceof Error ? e.message : e);
    return u.kanal === "push" ? "fejl" : false;
  }
}

async function log(u: Faelles, m: Modtager, status: UdsendStatus, extra: { fejl?: string; reference?: string; metadata?: Record<string, unknown> } = {}) {
  if (u.udenUdsendelseslog === "storkbook_tjek" && u.type === "storkbook_tjek") return;
  try {
    const ins = svc().from("udsendelser").insert({
      kanal: u.kanal,
      type_noegle: u.type,
      modtager: m.modtager,
      modtager_employee_id: m.modtagerEmployeeId ?? null,
      modtager_candidate_id: m.modtagerCandidateId ?? null,
      modtager_user_id: m.modtagerUserId ?? null,
      emne: u.emne ?? null,
      status,
      fejl: extra.fejl ? extra.fejl.slice(0, 1000) : null,
      reference: extra.reference ?? null,
      afsenderfunktion: u.afsenderfunktion,
      metadata: { ...(u.metadata ?? {}), ...(extra.metadata ?? {}) },
    });
    const ls = u.logSignal?.() ?? u.signal;
    const { error } = await (ls ? (ins as unknown as { abortSignal: (x: AbortSignal) => typeof ins }).abortSignal(ls) : ins);
    if (error) throw error;
  } catch (e) {
    console.error("udsend: logning fejlede", u.type, e instanceof Error ? e.message : e);
  }
}

/** Brugerens auth-id: kendt direkte eller slået op via medarbejder-id. "fejl" ved opslagsfejl (push stopper; mail/SMS fail-open). */
async function brugerId(m: Modtager, u?: Faelles): Promise<string | undefined | "fejl"> {
  if (m.modtagerUserId) return m.modtagerUserId;
  if (!m.modtagerEmployeeId) return undefined;
  try {
    const q = svc().from("employee_master_data").select("auth_user_id").eq("id", m.modtagerEmployeeId);
    const { data, error } = await (u ? sig(u, q) : q).maybeSingle();
    if (error) throw error;
    return data?.auth_user_id ?? undefined;
  } catch (e) {
    console.error("udsend: kunne ikke slå bruger op", (e as Error)?.message ?? e);
    return "fejl";
  }
}

/** Modtagerregel (roller/teams/rettighed). Kun et eksplicit false stopper; ukendt bruger eller fejl = send. */
async function udenforRegel(u: Faelles, userId?: string): Promise<boolean | "fejl"> {
  if (!userId) return false;
  try {
    const { data, error } = await sig(u, svc().rpc("udsendelse_tilladt", { p_user_id: userId, p_type: u.type }));
    if (error) throw error;
    return data === false;
  } catch (e) {
    console.error("udsend: regeltjek fejlede", u.type, (e as Error)?.message ?? e);
    return u.kanal === "push" ? "fejl" : false;
  }
}

const fejltekst = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Én udsendelse til én modtager. Kaster videre, hvis send() kaster. */
export async function udsend(u: Udsendelse): Promise<UdsendStatus> {
  const obl = { v: false };
  const gate = await typeGate(u, obl);
  if (gate) { await log(u, u, gate); return gate; }
  const opslag = await brugerId(u, u);
  if (opslag === "fejl" && u.kanal === "push") { await log(u, u, "fejl", { fejl: "db" }); return "fejl"; }
  const uid = opslag === "fejl" ? undefined : opslag;
  // Push uden bruger kan ikke leveres (status "ingen_tilmelding"; "sprunget_over" findes ikke i udsendelser).
  if (!uid && u.kanal === "push") { await log(u, u, "ingen_tilmelding"); return "ingen_tilmelding"; }
  const regel = await udenforRegel(u, uid);
  if (regel === "fejl") { await log(u, u, "fejl", { fejl: "db" }); return "fejl"; }
  if (regel) { await log(u, u, "udenfor_regel"); return "udenfor_regel"; }
  const fra = obl.v ? false : await fravalgt(u, uid);
  if (fra === "fejl") { await log(u, u, "fejl", { fejl: "db" }); return "fejl"; }
  if (fra) { await log(u, u, "fravalgt"); return "fravalgt"; }
  try {
    const r = await u.send();
    const status: UdsendStatus = (r && r.status) || "sendt";
    // Logfejl ændrer aldrig et afgjort udfald (log() kaster ikke).
    await log(u, u, status, { reference: r?.reference, metadata: r?.metadata, fejl: r?.fejl });
    return status;
  } catch (e) {
    await log(u, u, "fejl", { fejl: fejltekst(e) });
    throw e;
  }
}

/**
 * Ét afsendelseskald til flere modtagere (fx én mail med flere To-adresser).
 * Fravalgte modtagere fjernes fra kaldet; én logrække pr. modtager. Kaster videre ved fejl.
 */
export async function udsendFlere(
  u: Faelles & { modtagere: Modtager[]; send: (tilladte: string[]) => Promise<{ reference?: string } | void> },
): Promise<UdsendStatus> {
  const obl = { v: false };
  const gate = await typeGate(u, obl);
  if (gate) { for (const m of u.modtagere) await log(u, m, gate); return gate; }
  const tilladte: Modtager[] = [];
  let udenfor = 0;
  let fejl = 0;
  const push = u.kanal === "push";
  for (const m of u.modtagere) {
    // Push er fail-closed som i udsend(): bruger-, regel- og præferencefejl stopper modtageren med "fejl".
    const b = await brugerId(m, u);
    if (b === "fejl" && push) { await log(u, m, "fejl", { fejl: "db" }); fejl++; continue; }
    const uid = b === "fejl" ? undefined : b;
    if (!uid && push) { await log(u, m, "ingen_tilmelding"); continue; }
    const regel = await udenforRegel(u, uid);
    if (regel === "fejl") { await log(u, m, "fejl", { fejl: "db" }); fejl++; continue; }
    if (regel) { await log(u, m, "udenfor_regel"); udenfor++; continue; }
    const fra = obl.v ? false : await fravalgt(u, uid);
    if (fra === "fejl") { await log(u, m, "fejl", { fejl: "db" }); fejl++; continue; }
    if (fra) { await log(u, m, "fravalgt"); continue; }
    tilladte.push(m);
  }
  if (!tilladte.length && u.modtagere.length) {
    if (fejl) return "fejl";
    return udenfor === u.modtagere.length ? "udenfor_regel" : "fravalgt";
  }
  try {
    const r = await u.send(tilladte.map((m) => m.modtager));
    for (const m of tilladte) await log(u, m, "sendt", { reference: r?.reference });
    return "sendt";
  } catch (e) {
    for (const m of tilladte) await log(u, m, "fejl", { fejl: fejltekst(e) });
    throw e;
  }
}
