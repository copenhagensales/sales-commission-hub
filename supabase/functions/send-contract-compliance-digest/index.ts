import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get M365 access token: ${response.status}`);
  }
  const data = await response.json();
  return data.access_token;
}

async function sendEmail(accessToken: string, to: string[], subject: string, htmlBody: string) {
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
          toRecipients: to.map((address) => ({ emailAddress: { address } })),
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`Send email failed [${response.status}]: ${error}`);
    throw new Error(`Failed to send email: ${response.status}`);
  }
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

interface ComplianceRow {
  first_name: string;
  last_name: string;
  job_title: string | null;
  team_name: string | null;
  employment_start_date: string;
  compliance_state: string;
  sent_at: string | null;
  reminder_count: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let dryRun = false;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      dryRun = body?.dry_run === true;
    }

    const { data: policyRow, error: policyError } = await supabase
      .from("contract_policy_settings")
      .select("enabled, config")
      .eq("key", "management_digest")
      .maybeSingle();

    if (policyError) {
      console.error("Could not read digest policy:", policyError);
      throw policyError;
    }

    // Default is OFF — the digest never sends unless explicitly enabled.
    if (!policyRow?.enabled) {
      console.log("Management digest disabled — skipping");
      return new Response(JSON.stringify({ message: "Digest disabled", sent: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = (policyRow.config ?? {}) as { recipients?: string[]; weekdays_only?: boolean };
    const recipients = (config.recipients ?? []).filter((r) => typeof r === "string" && r.includes("@"));

    if (recipients.length === 0) {
      console.log("Digest enabled but no recipients configured");
      return new Response(JSON.stringify({ message: "No recipients configured", sent: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (config.weekdays_only !== false) {
      const day = new Date().getUTCDay();
      if (day === 0 || day === 6) {
        console.log("Weekend — skipping digest");
        return new Response(JSON.stringify({ message: "Weekend skip", sent: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: rows, error: rpcError } = await supabase.rpc("get_contract_compliance");
    if (rpcError) {
      console.error("Compliance RPC failed:", rpcError);
      throw rpcError;
    }

    const all = (rows ?? []) as ComplianceRow[];
    const missing = all.filter((r) => r.compliance_state === "missing");
    const startedUnsigned = all.filter((r) => r.compliance_state === "started_unsigned");

    if (missing.length === 0 && startedUnsigned.length === 0) {
      console.log("Nothing to report — no email sent");
      return new Response(JSON.stringify({ message: "Nothing to report", sent: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rowHtml = (list: ComplianceRow[]) =>
      list
        .map(
          (r) => `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(`${r.first_name} ${r.last_name}`)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.team_name ?? "Uden team")}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.employment_start_date)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.job_title ?? "")}</td>
          </tr>`
        )
        .join("");

    const section = (title: string, color: string, list: ComplianceRow[]) =>
      list.length === 0
        ? ""
        : `<h3 style="color:${color};margin:24px 0 8px;">${title} (${list.length})</h3>
           <table style="width:100%;border-collapse:collapse;font-size:14px;">
             <tr style="background:#f3f4f6;text-align:left;">
               <th style="padding:6px 10px;">Navn</th><th style="padding:6px 10px;">Team</th>
               <th style="padding:6px 10px;">Opstart</th><th style="padding:6px 10px;">Stilling</th>
             </tr>
             ${rowHtml(list)}
           </table>`;

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;background:#f5f5f5;padding:20px;">
        <div style="max-width:720px;margin:0 auto;background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
          <h2 style="margin:0;">Kontrakt-status</h2>
          <p style="color:#6b7280;">Automatisk overblik over medarbejdere, hvor kontrakten mangler.</p>
          ${section("Ansat uden kontrakt", "#dc2626", missing)}
          ${section("Startet uden underskrift", "#ea580c", startedUnsigned)}
          <p style="margin-top:24px;">
            <a href="https://stork.copenhagensales.dk/contracts" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Åbn overvågningen i Stork</a>
          </p>
        </div>
      </body></html>`;

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          recipients,
          missing: missing.length,
          started_unsigned: startedUnsigned.length,
          sent: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getM365AccessToken();
    await sendEmail(
      accessToken,
      recipients,
      `Kontrakt-status: ${missing.length} uden kontrakt, ${startedUnsigned.length} startet uden underskrift`,
      htmlBody
    );

    console.log(`Digest sent to ${recipients.length} recipient(s)`);
    return new Response(
      JSON.stringify({
        sent: true,
        recipients: recipients.length,
        missing: missing.length,
        started_unsigned: startedUnsigned.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("send-contract-compliance-digest error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
