// deno-lint-ignore-file no-explicit-any
/**
 * Web Push – ekstra kanal ved siden af mail. Kaster ALDRIG: en push-fejl må ikke
 * få den kaldende alarm til at fejle. Tekster må aldrig indeholde beløb, navne
 * eller kundedetaljer (se pushText.ts).
 */
import webpush from "npm:web-push@3.6.7";
import { PUSH_TEXT, STORKBOOK_TYPER, type PushType } from "./pushText.ts";
import { udsend } from "./udsend.ts";

export type { PushType };
const PREF_COLUMN: Record<"klub" | "opstart_flag" | "missing_one_on_one" | "compliance", string> = {
  klub: "klub",
  opstart_flag: "opstart_flag",
  missing_one_on_one: "missing_one_on_one",
  compliance: "compliance",
};

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:km@copenhagensales.dk";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/** Slår auth-bruger-id op for medarbejdere. */
export async function authUsersForEmployees(svc: any, employeeIds: (string | null | undefined)[]): Promise<string[]> {
  const ids = [...new Set(employeeIds.filter((x): x is string => !!x))];
  if (!ids.length) return [];
  const { data } = await svc.from("employee_master_data").select("auth_user_id").in("id", ids);
  return [...new Set((data ?? []).map((r: any) => r.auth_user_id).filter(Boolean))] as string[];
}

export async function authUsersForEmails(svc: any, emails: string[]): Promise<string[]> {
  const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!list.length) return [];
  const { data } = await svc.from("employee_master_data").select("auth_user_id, work_email").in("work_email", list);
  return [...new Set((data ?? []).map((r: any) => r.auth_user_id).filter(Boolean))] as string[];
}

export type Udfald = {
  status: "sendt" | "ikke_sendt" | "ukendt" | "fravalgt" | "ingen_tilmelding" | "stille_timer" | "slaaet_fra" | "udenfor_regel" | "fejl" | "allerede_sendt";
  aarsag?: string;
  transportForsoegt: boolean;
  abonnementer: { id: string; kode: number | null; status: "sendt" | "ikke_sendt" | "ukendt" | "doedt" }[];
};

export type PushOpts = {
  dedupeKey?: string; url?: string; udsendType?: string; afsenderfunktion?: string;
  tekst?: { title: string; body: string }; navne?: Record<string, string>;
  tag?: string; renotify?: boolean; ttlSekunder?: number; signal?: AbortSignal; maksAbonnementer?: number;
};

const STORKBOOK = new Set<string>(STORKBOOK_TYPER);
const TRANSPORT_TIMEOUT_MS = 8000;

/** Klassifikation pr. abonnement (whitelist; resten ukendt). */
export function klassificer(kode: number | null): "sendt" | "ikke_sendt" | "ukendt" | "doedt" {
  if (kode === 200 || kode === 201) return "sendt";
  if (kode === 404 || kode === 410) return "doedt";
  if (kode === 400 || kode === 401 || kode === 403 || kode === 413 || kode === 429) return "ikke_sendt";
  return "ukendt";
}

/** Sender ét abonnement via fetch (afbrydes af signal og 8 s timeout). Stub ved PUSH_STUB=1 (kun testkopi). */
async function transport(sub: { id: string; endpoint: string; p256dh: string; auth: string }, payload: string, ttl: number, signal?: AbortSignal): Promise<number | null> {
  if (Deno.env.get("PUSH_STUB") === "1") {
    let koder: Record<string, number | null> = {};
    try { koder = JSON.parse(Deno.env.get("PUSH_STUB_KODER") ?? "{}"); } catch { koder = {}; }
    const k = sub.id in koder ? koder[sub.id] : Number(Deno.env.get("PUSH_STUB_KODE") ?? "201");
    if (k === null) throw new Error("stub netværk");
    return k;
  }
  const det: any = webpush.generateRequestDetails({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: ttl, urgency: "high" });
  const t = AbortSignal.timeout(TRANSPORT_TIMEOUT_MS);
  const sig = signal ? AbortSignal.any([signal, t]) : t;
  const res = await fetch(det.endpoint, { method: det.method ?? "POST", headers: det.headers, body: det.body, signal: sig });
  await res.body?.cancel().catch(() => {});
  return res.status;
}

function fejlkode(kode: number | null, e?: unknown): string {
  if (kode !== null) return `http_${kode}`;
  const n = (e as Error)?.name;
  return n === "TimeoutError" || n === "AbortError" ? "timeout" : "netvaerk";
}

/**
 * Sender én type push og returnerer udfald pr. bruger. Kaster ALDRIG.
 */
export async function sendPushUdfald(svc: any, userIds: string[], type: PushType, opts: PushOpts = {}): Promise<{ sendt: number; udfald: Record<string, Udfald> }> {
  const udfald: Record<string, Udfald> = {};
  let sendt = 0;
  const sb = STORKBOOK.has(type);
  const sig = <T>(q: T): T => (opts.signal ? (q as any).abortSignal(opts.signal) : q);
  const users = [...new Set(userIds)];
  if (!users.length) return { sendt, udfald };
  let vapid = false;
  try { vapid = configure() || Deno.env.get("PUSH_STUB") === "1"; } catch { vapid = false; }
  if (!vapid) {
    for (const u of users) udfald[u] = { status: "fejl", aarsag: "vapid_mangler", transportForsoegt: false, abonnementer: [] };
    return { sendt, udfald };
  }
  let msg: { title: string; body: string; url: string } = PUSH_TEXT[type];
  try {
    // Tekst fra udsendelsestyper, hvis alle tre felter er udfyldt; ellers PUSH_TEXT (fail-open). opts.tekst vinder.
    if (opts.udsendType && !opts.tekst) {
      try {
        const { data: t, error } = await sig(svc.from("udsendelsestyper").select("push_titel, push_tekst, push_link")
          .eq("noegle", opts.udsendType)).maybeSingle();
        if (error) throw error;
        if (t?.push_titel && t?.push_tekst && t?.push_link) msg = { title: t.push_titel, body: t.push_tekst, url: t.push_link };
      } catch (e) {
        console.error("push: kunne ikke hente tekst for", opts.udsendType, (e as Error)?.message ?? e);
      }
    }
    if (opts.tekst) msg = { ...msg, ...opts.tekst };
  } catch { /* behold standardtekst */ }
  const udsendType = opts.udsendType ?? `push-${type}`;
  const afsender = opts.afsenderfunktion ?? "push";
  const ttl = opts.ttlSekunder ?? 60 * 60 * 24;
  const logPush = async (row: Record<string, unknown>) => {
    try { await sig(svc.from("push_log").insert(row)); } catch { /* logfejl ændrer intet */ }
  };

  for (const userId of users) {
    const res: Udfald = { status: "fejl", transportForsoegt: false, abonnementer: [] };
    udfald[userId] = res;
    try {
      if (type !== "test" && opts.dedupeKey) {
        const { count, error } = await sig(svc.from("push_log").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("push_type", type).eq("dedupe_key", opts.dedupeKey).eq("status", "sent"));
        if (error) {
          if (sb) { res.aarsag = "db"; continue; }
        } else if ((count ?? 0) > 0) {
          res.status = "allerede_sendt";
          if (sb) await logPush({ user_id: userId, push_type: type, dedupe_key: opts.dedupeKey, status: "already_sent" });
          continue;
        }
      }
      let payload: string;
      try {
        payload = JSON.stringify({ title: msg.title, body: msg.body, url: opts.url ?? msg.url, tag: opts.tag ?? type, renotify: !!opts.renotify });
      } catch {
        res.aarsag = "payload";
        continue;
      }
      const status = await udsend({
        type: udsendType, kanal: "push", modtager: opts.navne?.[userId] ?? userId, modtagerUserId: userId,
        emne: msg.title, afsenderfunktion: afsender, metadata: { push_type: type, dedupe_key: opts.dedupeKey ?? null },
        signal: opts.signal,
        send: async () => {
          if (type in PREF_COLUMN) {
            const { data: pref, error: pErr } = await sig(svc.from("push_preferences").select("*").eq("user_id", userId)).maybeSingle();
            if (pErr && sb) return { status: "fejl" as const, fejl: "db" };
            if (pref && pref[PREF_COLUMN[type as keyof typeof PREF_COLUMN]] === false) {
              await logPush({ user_id: userId, push_type: type, dedupe_key: opts.dedupeKey ?? null, status: "skipped_pref" });
              return { status: "fravalgt" as const };
            }
          }
          let q = svc.from("push_subscriptions").select("id, endpoint, p256dh, auth")
            .eq("user_id", userId).eq("is_active", true)
            .order("last_success_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
          if (opts.maksAbonnementer) q = q.limit(opts.maksAbonnementer);
          const { data: subs, error: sErr } = await sig(q);
          if (sErr) {
            if (sb) return { status: "fejl" as const, fejl: "db" };
            throw sErr;
          }
          if (!subs?.length) {
            await logPush({ user_id: userId, push_type: type, dedupe_key: opts.dedupeKey ?? null, status: "no_subscription" });
            return { status: "ingen_tilmelding" as const };
          }
          let lastCode: number | null = null;
          let lastError: string | null = null;
          for (const s of subs) {
            if (!s?.id || !s.endpoint || !s.p256dh || !s.auth) {
              res.abonnementer.push({ id: String(s?.id ?? ""), kode: null, status: "ikke_sendt" });
              continue;
            }
            let kode: number | null = null;
            let fejl: unknown = undefined;
            res.transportForsoegt = true;
            try {
              kode = await transport(s, payload, ttl, opts.signal);
            } catch (e) {
              fejl = e;
            }
            const st = fejl === undefined ? klassificer(kode) : "ukendt";
            res.abonnementer.push({ id: s.id, kode, status: st });
            lastCode = kode;
            if (st === "sendt") {
              try { await sig(svc.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id)); } catch { /* ignorer */ }
            } else {
              lastError = sb ? fejlkode(kode, fejl) : String((fejl as Error)?.message ?? `http ${kode}`).slice(0, 200);
              if (st === "doedt") {
                try {
                  await sig(svc.from("push_subscriptions").update({ is_active: false, deactivated_at: new Date().toISOString() }).eq("id", s.id));
                } catch { /* ignorer */ }
                await logPush({ user_id: userId, push_type: type, dedupe_key: null, status: "deactivated", status_code: kode, error_text: lastError });
              } else {
                console.error("push send failed", kode ?? "unknown");
              }
            }
          }
          const a = res.abonnementer;
          const samlet: "sendt" | "ukendt" | "ikke_sendt" | "ingen_tilmelding" =
            a.some((x) => x.status === "sendt") ? "sendt"
            : a.some((x) => x.status === "ukendt") ? "ukendt"
            : a.length && a.every((x) => x.status === "doedt") ? "ingen_tilmelding" : "ikke_sendt";
          const logStatus = samlet === "sendt" ? "sent" : !sb ? "failed" : samlet === "ukendt" ? "unknown" : samlet === "ingen_tilmelding" ? "no_subscription" : "not_sent";
          await logPush({
            user_id: userId, push_type: type, dedupe_key: opts.dedupeKey ?? null,
            status: logStatus, status_code: lastCode, error_text: samlet === "sendt" ? null : lastError,
          });
          if (!sb && samlet !== "sendt" && samlet !== "ingen_tilmelding") throw new Error(`push failed ${lastCode ?? "unknown"}: ${lastError ?? ""}`);
          return { status: samlet, metadata: { abonnementer: a }, fejl: samlet === "sendt" ? undefined : lastError ?? undefined };
        },
      });
      res.status = status === "sendt" ? "sendt" : status;
      if (status === "fejl" && !res.aarsag) res.aarsag = res.transportForsoegt ? undefined : "db";
      if (status === "sendt") sendt++;
    } catch (e) {
      // Delresultater bevares; gamle typer: transportfejl kastes af send() og ender her.
      if (res.abonnementer.some((x) => x.status === "sendt")) { res.status = "sendt"; sendt++; }
      else if (res.transportForsoegt) res.status = res.abonnementer.some((x) => x.status === "ukendt") ? "ukendt" : "ikke_sendt";
      else { res.status = "fejl"; res.aarsag = res.aarsag ?? "db"; }
      console.error("push user failed", e instanceof Error ? e.message.slice(0, 80) : "unknown");
    }
  }
  return { sendt, udfald };
}

/**
 * Sender én type push til brugerne. `dedupeKey` forhindrer gentagelser for samme hændelse.
 * Returnerer antal sendte; fejl logges kun. Signatur uændret (kalder sendPushUdfald).
 */
export async function sendPush(
  svc: any,
  userIds: string[],
  type: PushType,
  opts: { dedupeKey?: string; url?: string; udsendType?: string; afsenderfunktion?: string; tekst?: { title: string; body: string }; navne?: Record<string, string> } = {},
): Promise<number> {
  try {
    const r = await sendPushUdfald(svc, userIds, type, opts);
    return r.sendt;
  } catch (e) {
    console.error("push failed", e instanceof Error ? e.message : "unknown");
    return 0;
  }
}
