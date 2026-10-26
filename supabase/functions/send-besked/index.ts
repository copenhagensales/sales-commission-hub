// deno-lint-ignore-file no-explicit-any
/**
 * Ejerens manuelle besked (Udsendelser → Send). Kun ejere. Én logrække pr. modtager via udsend.
 * Mail: _shared/m365-mail.ts · SMS: Twilio som send-employee-sms · Push: _shared/push.ts.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";
import { requireOwner } from "../_shared/auth.ts";
import { udsend } from "../_shared/udsend.ts";
import { sendM365Mail } from "../_shared/m365-mail.ts";
import { sendPush } from "../_shared/push.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  kanal: z.enum(["mail", "sms", "push"]),
  maal: z.enum(["mig", "alle", "roller", "teams", "medarbejder"]),
  ids: z.array(z.string().max(100)).max(200).default([]),
  emne: z.string().trim().max(200).default(""),
  tekst: z.string().trim().min(1).max(5000),
  kunAntal: z.boolean().default(false),
});

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

async function sendSms(to: string, body: string): Promise<string | undefined> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID"), token = Deno.env.get("TWILIO_AUTH_TOKEN"), from = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!sid || !token || !from) throw new Error("SMS service not configured");
  let toNumber = to.replace(/\s/g, "");
  if (!toNumber.startsWith("+")) toNumber = "+45" + toNumber.replace(/^0+/, "");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${token}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: toNumber, Body: body, StatusCallback: `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-sms-status` }),
  });
  const r = await res.json();
  if (!res.ok) throw new Error(`Twilio-fejl ${res.status}: ${r?.message ?? ""}`);
  return r?.sid;
}

/** Start på dagen i Europe/Copenhagen som ISO (UTC). */
function dagsStartKbh(): string {
  const nu = new Date();
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(nu);
  const midnatUtc = new Date(`${d}T00:00:00Z`);
  const kbh = new Date(midnatUtc.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
  const off = kbh.getTime() - new Date(midnatUtc.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(midnatUtc.getTime() - off).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireOwner(req);
  if (auth instanceof Response) return auth;
  const svc: any = auth.svc;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    // Modtagere: aktive medarbejdere
    let q = svc.from("employee_master_data").select("id, auth_user_id, work_email, private_phone, first_name, last_name").eq("is_active", true);
    if (b.maal === "mig") q = q.eq("auth_user_id", auth.userId);
    else if (b.maal === "alle") q = q.not("auth_user_id", "is", null);
    else {
      if (!b.ids.length) return json({ error: "Vælg mindst én modtager" }, 400);
      if (b.maal === "medarbejder" && b.ids.length !== 1) return json({ error: "Vælg én medarbejder" }, 400);
      if (b.maal === "medarbejder") q = q.in("id", b.ids);
      else if (b.maal === "teams") {
        const { data: tm, error } = await svc.from("team_members").select("employee_id").in("team_id", b.ids);
        if (error) throw error;
        q = q.in("id", [...new Set((tm ?? []).map((r: any) => r.employee_id))].concat(["00000000-0000-0000-0000-000000000000"]));
      } else {
        const { data: pos, error } = await svc.from("job_positions").select("id").in("system_role_key", b.ids);
        if (error) throw error;
        q = q.in("position_id", (pos ?? []).map((r: any) => r.id).concat(["00000000-0000-0000-0000-000000000000"]));
      }
    }
    const { data: emps, error: eErr } = await q;
    if (eErr) throw eErr;
    const alleModt = (emps ?? []) as any[];
    const type = `send-besked-${b.kanal}`;
    const emne = b.emne || "Besked fra Stork";

    // Dagsloft: højst én send-besked pr. modtager pr. dansk kalenderdag (ikke for »mig«). Fail-open.
    const fikIDag = new Set<string>();
    if (b.maal !== "mig" && alleModt.length) {
      try {
        const start = dagsStartKbh();
        const empIds = alleModt.map((e) => e.id);
        const uids = alleModt.map((e) => e.auth_user_id).filter(Boolean);
        for (let i = 0; i < Math.max(empIds.length, uids.length); i += 200) {
          const [a, c] = await Promise.all([
            svc.from("udsendelser").select("modtager_employee_id").like("type_noegle", "send-besked-%").eq("status", "sendt")
              .gte("tidspunkt", start).in("modtager_employee_id", empIds.slice(i, i + 200).concat(["00000000-0000-0000-0000-000000000000"])),
            svc.from("udsendelser").select("modtager_user_id").like("type_noegle", "send-besked-%").eq("status", "sendt")
              .gte("tidspunkt", start).in("modtager_user_id", uids.slice(i, i + 200).concat(["00000000-0000-0000-0000-000000000000"])),
          ]);
          if (a.error) throw a.error;
          if (c.error) throw c.error;
          const harE = new Set((a.data ?? []).map((r: any) => r.modtager_employee_id));
          const harU = new Set((c.data ?? []).map((r: any) => r.modtager_user_id));
          for (const e of alleModt) if (harE.has(e.id) || (e.auth_user_id && harU.has(e.auth_user_id))) fikIDag.add(e.id);
        }
      } catch (err) {
        console.error("send-besked: dagsloft-opslag fejlede", err instanceof Error ? err.message : err);
      }
    }
    // Ejere er undtaget dagsloftet. Fail-open: fejler opslaget, gælder loftet som i dag.
    for (const e of alleModt.filter((x) => fikIDag.has(x.id) && x.auth_user_id)) {
      try {
        const { data, error } = await svc.rpc("is_owner", { _user_id: e.auth_user_id });
        if (error) throw error;
        if (data === true) fikIDag.delete(e.id);
      } catch (err) {
        console.error("send-besked: ejer-opslag fejlede", err instanceof Error ? err.message : err);
      }
    }
    // Bevidst ikke atomisk: to samtidige kald kan begge nå forbi loftet (accepteret, kun ejere sender manuelt).
    const loft = fikIDag.size;
    if (b.kunAntal) return json({ antal: alleModt.length, loft });
    const modt = alleModt.filter((e) => !fikIDag.has(e.id));
    const navn = (e: { id: string; first_name?: string | null; last_name?: string | null }) =>
      `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() || e.id;
    for (const e of alleModt.filter((x) => fikIDag.has(x.id))) {
      const adr = b.kanal === "mail" ? e.work_email : b.kanal === "sms" ? e.private_phone : (e.auth_user_id ? navn(e) : null);
      const { error } = await svc.from("udsendelser").insert({
        kanal: b.kanal, type_noegle: type, modtager: adr ?? e.id, modtager_employee_id: e.id,
        modtager_user_id: e.auth_user_id ?? null, emne, status: "dagsloft", afsenderfunktion: "send-besked", metadata: {},
      });
      if (error) console.error("send-besked: kunne ikke logge dagsloft", error.message);
    }
    let sendt = 0, sprunget = 0, fejl = 0, udenAdresse = 0;

    if (b.kanal === "push") {
      const users = modt.map((e) => e.auth_user_id).filter(Boolean);
      udenAdresse = modt.length - users.length;
      const navne: Record<string, string> = {};
      for (const e of modt) if (e.auth_user_id) navne[e.auth_user_id] = navn(e);
      sendt = await sendPush(svc, users, "test", {
        navne, udsendType: type, afsenderfunktion: "send-besked", url: "/", tekst: { title: emne, body: b.tekst },
      });
      sprunget = users.length - sendt;
    } else {
      for (const e of modt) {
        const adr = b.kanal === "mail" ? e.work_email : e.private_phone;
        if (!adr) { udenAdresse++; continue; }
        try {
          const s = await udsend({
            type, kanal: b.kanal, modtager: adr, modtagerEmployeeId: e.id, modtagerUserId: e.auth_user_id ?? undefined,
            emne, afsenderfunktion: "send-besked",
            send: async () => {
              if (b.kanal === "mail") {
                await sendM365Mail({ to: [adr], subject: emne, html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${esc(b.tekst)}</div>` });
                return;
              }
              return { reference: await sendSms(adr, b.tekst) };
            },
          });
          if (s === "sendt") sendt++; else sprunget++;
        } catch (err) {
          fejl++;
          console.error("send-besked: afsendelse fejlede", err instanceof Error ? err.message : err);
        }
      }
    }
    return json({ antal: alleModt.length, sendt, sprunget, fejl, loft, udenAdresse });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Fejl" }, 500);
  }
});
