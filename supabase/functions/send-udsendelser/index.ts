import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { udsend } from "../_shared/udsend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_KOERSEL = 100;
const BATCH = 20;

async function getM365AccessToken(): Promise<string> {
  const tenantId = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("M365 credentials not configured");
  }
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  if (!response.ok) {
    await response.text();
    throw new Error(`M365 token-fejl (${response.status})`);
  }
  const data = await response.json();
  return data.access_token;
}

async function sendEmail(accessToken: string, to: string, subject: string, htmlBody: string) {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  if (!senderEmail) throw new Error("M365_SENDER_EMAIL not configured");
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: htmlBody },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    },
  );
  if (!response.ok) {
    await response.text();
    throw new Error(`Graph sendMail-fejl (${response.status})`);
  }
}

interface Udsendelse {
  id: number;
  lease: string;
  modtager: string;
  emne: string;
  html: string;
  forsoeg: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let sendt = 0;
    let fejlet = 0;
    let token: string | null = null;

    while (sendt + fejlet < MAX_PER_KOERSEL) {
      const antal = Math.min(BATCH, MAX_PER_KOERSEL - sendt - fejlet);
      const { data, error } = await svc.rpc("stork_udsendelse_tag", { p_antal: antal });
      if (error) throw new Error(`tag-fejl: ${error.code ?? "ukendt"}`);
      const rows = (data ?? []) as Udsendelse[];
      if (rows.length === 0) break;

      for (const row of rows) {
        let ok = false;
        let fejl: string | null = null;
        try {
          if (!token) token = await getM365AccessToken();
          const tk = token;
          const st = await udsend({
            type: "send-udsendelser", kanal: "mail", modtager: row.modtager, emne: row.emne, afsenderfunktion: "send-udsendelser",
            send: async () => { await sendEmail(tk, row.modtager, row.emne, row.html); },
          });
          if (st === "sendt") ok = true;
          else fejl = st; // slået fra/fravalgt i Udsendelser – ikke sendt
        } catch (e) {
          fejl = (e instanceof Error ? e.message : "ukendt fejl").slice(0, 200);
        }
        const { error: resErr } = await svc.rpc("stork_udsendelse_resultat", ok
          ? { p_id: row.id, p_lease: row.lease, p_ok: true }
          : { p_id: row.id, p_lease: row.lease, p_ok: false, p_fejl: fejl });
        if (resErr) console.error(`resultat-fejl for udsendelse ${row.id}: ${resErr.code ?? "ukendt"}`);
        if (ok) sendt++; else fejlet++;
      }
    }

    return json({ sendt, fejlet });
  } catch (e) {
    console.error("send-udsendelser fejl:", e instanceof Error ? e.message : "ukendt");
    return json({ error: e instanceof Error ? e.message : "Ukendt fejl" }, 500);
  }
});
