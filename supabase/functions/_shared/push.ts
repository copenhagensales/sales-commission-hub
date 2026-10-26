// deno-lint-ignore-file no-explicit-any
/**
 * Web Push – ekstra kanal ved siden af mail. Kaster ALDRIG: en push-fejl må ikke
 * få den kaldende alarm til at fejle. Tekster må aldrig indeholde beløb, navne
 * eller kundedetaljer (se pushText.ts).
 */
import webpush from "npm:web-push@3.6.7";
import { PUSH_TEXT, type PushType } from "./pushText.ts";
import { udsend } from "./udsend.ts";

export type { PushType };
const PREF_COLUMN: Record<Exclude<PushType, "test">, string> = {
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

/**
 * Sender én type push til brugerne. `dedupeKey` forhindrer gentagelser for samme hændelse.
 * Returnerer antal sendte; fejl logges kun.
 */
export async function sendPush(
  svc: any,
  userIds: string[],
  type: PushType,
  opts: { dedupeKey?: string; url?: string; udsendType?: string; afsenderfunktion?: string; tekst?: { title: string; body: string } } = {},
): Promise<number> {
  try {
    if (!userIds.length || !configure()) return 0;
    const msg = opts.tekst ? { ...PUSH_TEXT[type], ...opts.tekst } : PUSH_TEXT[type];
    let sent = 0;
    const udsendType = opts.udsendType ?? `push-${type}`;
    const afsender = opts.afsenderfunktion ?? "push";
    for (const userId of [...new Set(userIds)]) {
      try {
        if (type !== "test" && opts.dedupeKey) {
          const { count } = await svc.from("push_log").select("id", { count: "exact", head: true })
            .eq("user_id", userId).eq("push_type", type).eq("dedupe_key", opts.dedupeKey).eq("status", "sent");
          if ((count ?? 0) > 0) continue;
        }
        const status = await udsend({
          type: udsendType, kanal: "push", modtager: userId, modtagerUserId: userId,
          emne: msg.title, afsenderfunktion: afsender, metadata: { push_type: type, dedupe_key: opts.dedupeKey ?? null },
          send: async () => {
            if (type !== "test") {
              const { data: pref } = await svc.from("push_preferences").select("*").eq("user_id", userId).maybeSingle();
              if (pref && pref[PREF_COLUMN[type]] === false) {
                await svc.from("push_log").insert({ user_id: userId, push_type: type, dedupe_key: opts.dedupeKey ?? null, status: "skipped_pref" });
                return { status: "fravalgt" as const };
              }
            }
            const { data: subs } = await svc.from("push_subscriptions").select("id, endpoint, p256dh, auth")
              .eq("user_id", userId).eq("is_active", true);
            if (!subs?.length) {
              await svc.from("push_log").insert({ user_id: userId, push_type: type, dedupe_key: opts.dedupeKey ?? null, status: "no_subscription" });
              return { status: "ingen_tilmelding" as const };
            }
            let ok = false;
            let lastCode: number | null = null;
            let lastError: string | null = null;
            for (const s of subs) {
              try {
                const res: any = await webpush.sendNotification(
                  { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                  JSON.stringify({ title: msg.title, body: msg.body, url: opts.url ?? msg.url, tag: type }),
                  { TTL: 60 * 60 * 24, urgency: "high" },
                );
                ok = true;
                lastCode = typeof res?.statusCode === "number" ? res.statusCode : lastCode;
                await svc.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id);
              } catch (e: any) {
                const code = typeof e?.statusCode === "number" ? e.statusCode : null;
                lastCode = code;
                lastError = String(e?.body || e?.message || "unknown").slice(0, 200);
                if (code === 404 || code === 410) {
                  await svc.from("push_subscriptions").update({ is_active: false, deactivated_at: new Date().toISOString() }).eq("id", s.id);
                  await svc.from("push_log").insert({ user_id: userId, push_type: type, dedupe_key: null, status: "deactivated", status_code: code, error_text: lastError });
                } else {
                  console.error("push send failed", code ?? "unknown");
                }
              }
            }
            await svc.from("push_log").insert({
              user_id: userId, push_type: type, dedupe_key: opts.dedupeKey ?? null,
              status: ok ? "sent" : "failed", status_code: lastCode, error_text: ok ? null : lastError,
            });
            if (!ok) throw new Error(`push failed ${lastCode ?? "unknown"}: ${lastError ?? ""}`);
          },
        });
        if (status === "sendt") sent++;
      } catch (e) {
        console.error("push user failed", e instanceof Error ? e.message : "unknown");
      }
    }
    return sent;
  } catch (e) {
    console.error("push failed", e instanceof Error ? e.message : "unknown");
    return 0;
  }
}
