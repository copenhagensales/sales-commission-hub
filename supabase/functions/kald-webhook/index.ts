// kald-webhook (F0.1 TESTTILSTAND, plan v2.3 §2 greb 2): modtager Adversus' call_ended/callAnswered-webhooks
// og logger KUN feltnavne og -typer (aldrig værdier) i integration_logs, så payloadens indhold kan måles,
// før den egentlige kaldsopdatering bygges (F1a). Rå payload og URL logges aldrig (authKey ligger i querystring).
import { verifyWebhookSecret } from "../_shared/webhook-auth.ts";
import { feltTrae } from "../_shared/felttrae.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MAKS_BYTES = 256 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const svar = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return svar(405, { ok: false });
  const afvist = verifyWebhookSecret(req, "KALD_WEBHOOK_SECRET", { corsHeaders: cors, queryNames: ["authKey"] });
  if (afvist) return afvist;
  const dialerId = new URL(req.url).searchParams.get("dialer_id") ?? "";
  if (!UUID.test(dialerId)) return svar(400, { ok: false, fejl: "dialer_id" });
  const laengde = Number(req.headers.get("content-length") ?? 0);
  if (laengde > MAKS_BYTES) return svar(413, { ok: false });
  let body: unknown;
  try { body = await req.json(); } catch { return svar(400, { ok: false, fejl: "json" }); }
  const felter = feltTrae(body, 4);
  const event = typeof (body as Record<string, unknown>)?.event === "string" ? String((body as Record<string, unknown>).event) : null;
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await svc.from("integration_logs").insert({
    integration_type: "dialer", integration_id: dialerId, integration_name: "kald-webhook (test)", status: "success",
    message: `kald-webhook test: ${felter.length} felter${event ? ` (event ${event})` : ""}`,
    details: { tilstand: "test", event, antal_felter: felter.length, felter },
  });
  if (error) { console.error("[kald-webhook] log-fejl:", error.code ?? "ukendt"); return svar(500, { ok: false }); }
  return svar(200, { ok: true, felter: felter.length });
});
