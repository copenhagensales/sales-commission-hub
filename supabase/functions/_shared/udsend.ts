// deno-lint-ignore-file no-explicit-any
/**
 * Fælles port for alt, Stork sender ud (mail, SMS, push).
 * FAIL-OPEN: fejler opslag eller logning, sendes alligevel (fejl til konsollen).
 * Kun eksplicit `aktiv = false` på typen eller eksplicit fravalg stopper.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Kanal = "mail" | "sms" | "push";
export type UdsendStatus = "sendt" | "fejl" | "slaaet_fra" | "fravalgt" | "stille_timer" | "ingen_tilmelding" | "udenfor_regel";

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
}

export interface Udsendelse extends Faelles, Modtager {
  /** Selve afsendelsen. Må returnere status "ingen_tilmelding"/"fravalgt" (push), så det logges. */
  send: () => Promise<{ reference?: string; status?: "ingen_tilmelding" | "fravalgt" } | void>;
}

let client: any = null;
function svc(): any {
  if (!client) client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return client;
}

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
async function typeGate(u: Faelles): Promise<"slaaet_fra" | "stille_timer" | null> {
  try {
    const { data, error } = await svc().from("udsendelsestyper")
      .select("aktiv, stille_fra, stille_til").eq("noegle", u.type).maybeSingle();
    if (error) throw error;
    if (!data) {
      const { error: insErr } = await svc().from("udsendelsestyper").upsert(
        { noegle: u.type, navn: u.type, kanal: u.kanal, udloeser: "handling", afsenderfunktion: u.afsenderfunktion },
        { onConflict: "noegle", ignoreDuplicates: true },
      );
      if (insErr) console.error("udsend: kunne ikke oprette type", u.type, insErr.message);
      return null;
    }
    if (data.aktiv === false) return "slaaet_fra";
    if (u.kanal === "push" && iStilleTimer(data.stille_fra, data.stille_til)) return "stille_timer";
    return null;
  } catch (e) {
    console.error("udsend: typeopslag fejlede", u.type, e instanceof Error ? e.message : e);
    return null;
  }
}

async function fravalgt(u: Faelles, userId?: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await svc().from("udsendelsespraeferencer")
      .select("aktiv").eq("user_id", userId).eq("type_noegle", u.type).eq("kanal", u.kanal).maybeSingle();
    if (error) throw error;
    return data?.aktiv === false;
  } catch (e) {
    console.error("udsend: præferenceopslag fejlede", u.type, e instanceof Error ? e.message : e);
    return false;
  }
}

async function log(u: Faelles, m: Modtager, status: UdsendStatus, extra: { fejl?: string; reference?: string } = {}) {
  try {
    const { error } = await svc().from("udsendelser").insert({
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
      metadata: u.metadata ?? {},
    });
    if (error) throw error;
  } catch (e) {
    console.error("udsend: logning fejlede", u.type, e instanceof Error ? e.message : e);
  }
}

/** Brugerens auth-id: kendt direkte eller slået op via medarbejder-id. Fail-open: null ved fejl. */
async function brugerId(m: Modtager): Promise<string | undefined> {
  if (m.modtagerUserId) return m.modtagerUserId;
  if (!m.modtagerEmployeeId) return undefined;
  try {
    const { data, error } = await svc().from("employee_master_data")
      .select("auth_user_id").eq("id", m.modtagerEmployeeId).maybeSingle();
    if (error) throw error;
    return data?.auth_user_id ?? undefined;
  } catch (e) {
    console.error("udsend: kunne ikke slå bruger op", (e as Error)?.message ?? e);
    return undefined;
  }
}

/** Modtagerregel (roller/teams/rettighed). Kun et eksplicit false stopper; ukendt bruger eller fejl = send. */
async function udenforRegel(u: Faelles, userId?: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await svc().rpc("udsendelse_tilladt", { p_user_id: userId, p_type: u.type });
    if (error) throw error;
    return data === false;
  } catch (e) {
    console.error("udsend: regeltjek fejlede", u.type, (e as Error)?.message ?? e);
    return false;
  }
}

const fejltekst = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Én udsendelse til én modtager. Kaster videre, hvis send() kaster. */
export async function udsend(u: Udsendelse): Promise<UdsendStatus> {
  const gate = await typeGate(u);
  if (gate) { await log(u, u, gate); return gate; }
  const uid = await brugerId(u);
  if (await udenforRegel(u, uid)) { await log(u, u, "udenfor_regel"); return "udenfor_regel"; }
  if (await fravalgt(u, u.modtagerUserId)) { await log(u, u, "fravalgt"); return "fravalgt"; }
  try {
    const r = await u.send();
    const status: UdsendStatus = (r && r.status) || "sendt";
    await log(u, u, status, { reference: r?.reference });
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
  const gate = await typeGate(u);
  if (gate) { for (const m of u.modtagere) await log(u, m, gate); return gate; }
  const tilladte: Modtager[] = [];
  let udenfor = 0;
  for (const m of u.modtagere) {
    if (await udenforRegel(u, await brugerId(m))) { await log(u, m, "udenfor_regel"); udenfor++; }
    else if (await fravalgt(u, m.modtagerUserId)) await log(u, m, "fravalgt");
    else tilladte.push(m);
  }
  if (!tilladte.length && u.modtagere.length) return udenfor === u.modtagere.length ? "udenfor_regel" : "fravalgt";
  try {
    const r = await u.send(tilladte.map((m) => m.modtager));
    for (const m of tilladte) await log(u, m, "sendt", { reference: r?.reference });
    return "sendt";
  } catch (e) {
    for (const m of tilladte) await log(u, m, "fejl", { fejl: fejltekst(e) });
    throw e;
  }
}
