// enreach-hook (B3/B4, fase0/samtaler/b1-enreach-kaldsdata-krav.md krav 13–14): modtager HeroBase-hooks (én pr. lead-ændring) og skriver gennem
// SAMME sink som polling (_shared/sessions-sink.ts): sletteregel-port pr. kampagne, »kun egne medarbejdere«, katalog, sælger-alias – ingen sidevej.
// Kun konti på den nye vej (config.sessions_v1) behandles; andre hooks kvitteres uden lagring. Rå payload, URL og kundefelter (data.*) logges/gemmes aldrig.
// Kald fra HeroBase: POST ?dialer_id=<integration-uuid> med header x-webhook-secret: <ENREACH_HOOK_SECRET> (header, ikke querystring – gatewayens logs indeholder request.url; Codex B3 r1).
import { verifyWebhookSecret } from "../_shared/webhook-auth.ts";
import { processSessionsSink, type LogFn } from "../_shared/sessions-sink.ts";
import { tilSessionDto, type HookValidering } from "../_shared/enreach-hook-map.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MAKS_BYTES = 256 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const svar = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return svar(405, { ok: false });
  // Fail-closed: uden konfigureret hemmelighed afvises alt (requireConfigured) – en hook, der skriver data, må ikke være åben
  const afvist = verifyWebhookSecret(req, "ENREACH_HOOK_SECRET", { corsHeaders: cors, headerNames: ["x-webhook-secret"], queryNames: [], requireConfigured: true });
  if (afvist) return afvist;
  const dialerId = new URL(req.url).searchParams.get("dialer_id") ?? "";
  if (!UUID.test(dialerId)) return svar(400, { ok: false, fejl: "dialer_id" });
  if (Number(req.headers.get("content-length") ?? 0) > MAKS_BYTES) return svar(413, { ok: false });
  // Faktisk læste bytes begrænses (Content-Length kan mangle/lyve – Codex B3 r1)
  let tekst = "";
  try {
    const reader = req.body?.getReader(); if (!reader) return svar(400, { ok: false, fejl: "tom" });
    const dele: Uint8Array[] = []; let laest = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; laest += value.byteLength; if (laest > MAKS_BYTES) { await reader.cancel(); return svar(413, { ok: false }); } dele.push(value); }
    const alt = new Uint8Array(laest); let o = 0; for (const d of dele) { alt.set(d, o); o += d.byteLength; }
    tekst = new TextDecoder().decode(alt);
  } catch { return svar(400, { ok: false, fejl: "body" }); }
  let body: unknown;
  try { body = JSON.parse(tekst); } catch { return svar(400, { ok: false, fejl: "json" }); }

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: integ, error } = await svc.from("dialer_integrations").select("id, name, provider, is_active, config").eq("id", dialerId).maybeSingle();
  if (error || !integ || integ.provider !== "enreach" || !integ.is_active) return svar(404, { ok: false, fejl: "integration" });
  if (integ.config?.sessions_v1 !== true) return svar(202, { ok: true, ignoreret: "kontoen er ikke på sessions-porten" });
  const validering: HookValidering = { ok: true, kasseret: [] };
  const dto = tilSessionDto(body, String(integ.name), validering);
  if (!dto) return svar(400, { ok: false, fejl: "payload uden gyldigt uniqueId" });
  // Codex B3 r2: en payload med kasserede felter eller uden versionstid (lastModifiedTime) afvises HELT – ellers kunne »unknown«/null overskrive gyldige værdier. Polling samler emnet op.
  if (validering.kasseret.length > 0 || !dto.endTime) {
    await svc.from("integration_logs").insert({
      integration_type: "dialer", integration_id: integ.id, integration_name: integ.name, status: "warning",
      message: "enreach-hook: payload afvist (ugyldige felter eller manglende versionstid) – intet gemt",
      details: { via: "hook", afvist: true, kasserede_felter: validering.kasseret, versionstid: !!dto.endTime },
    });
    return svar(400, { ok: false, fejl: "ugyldig payload", kasserede_felter: validering.kasseret, versionstid: !!dto.endTime });
  }

  // Faste fejlkoder i rækker (aldrig beskeder fra sink/DB, som kan gengive værdier); fuld tekst kun i konsollen uden payload-værdier er ikke garanteret → kun typen logges dér
  const koder = new Set<string>();
  const log: LogFn = (type, msg) => { if (type !== "INFO") koder.add(type === "ERROR" ? (msg.includes("sletteregel-port") ? "PORT_FEJL" : msg.includes("alias") ? "ALIAS_FEJL" : msg.includes("katalog") ? "KATALOG_FEJL" : "LAGRING_FEJL") : (msg.includes("sletteregel-port") ? "UDEN_REGEL" : msg.includes("kun egne") ? "IKKE_TILLADT" : "ADVARSEL")); console.log(`[enreach-hook ${integ.name}] ${type}`); };
  const r = await processSessionsSink(svc, [dto], integ.id, 1, log);
  // Kun afvigelser logges som rækker (succes er stille): ikke gemt (regel/tilladelse) eller fejl – så »modtaget, ikke gemt« kan ses (krav 13d). Status: success/error/warning (tabellens CHECK).
  if (r.errors > 0 || r.processed === 0) {
    await svc.from("integration_logs").insert({
      integration_type: "dialer", integration_id: integ.id, integration_name: integ.name, status: r.errors > 0 ? "error" : "warning",
      message: r.errors > 0 ? "enreach-hook: lagring fejlede" : `enreach-hook: modtaget, ikke gemt (${r.uden_regel ? "kampagne uden sletteregel" : r.uden_tilladelse ? "bruger ikke tilladt" : "frasorteret"})`,
      details: { via: "hook", processed: r.processed, errors: r.errors, uden_regel: r.uden_regel ?? 0, uden_tilladelse: r.uden_tilladelse ?? 0, kampagner_registreret: r.kampagner_registreret ?? 0, koder: [...koder] },
    });
  }
  return svar(r.errors > 0 ? 500 : 200, { ok: r.errors === 0, processed: r.processed, uden_regel: r.uden_regel ?? 0, uden_tilladelse: r.uden_tilladelse ?? 0 });
});
