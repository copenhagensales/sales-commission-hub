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
    },
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
    },
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

const SEVERITY_COLOR: Record<string, string> = {
  KRITISK: "#dc2626",
  HOEJ: "#ea580c",
  MIDDEL: "#ca8a04",
  INFO: "#2563eb",
};

interface PayloadAlert {
  alvor?: string;
  titel?: string;
  maalt?: number | string | null;
  graense?: number | string | null;
  aaben_i_dage?: number | null;
  detaljer?: Record<string, unknown> | null;
}

interface MailPayload {
  send_mail?: boolean;
  grund?: string;
  kritiske?: number;
  aabne_i_alt?: number;
  timer_siden_kontrol?: number | null;
  timer_siden_oprydning?: number | null;
  alarmer?: PayloadAlert[];
}

/**
 * Detail-felter vises kun som navn + tal/kort tekst. Objekter og lange
 * strenge udelades, så ingen kundedata kan slippe med i mailen.
 */
const detailLines = (detail: Record<string, unknown> | null | undefined): string[] => {
  if (!detail || typeof detail !== "object") return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(detail)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "number" || typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === "string") {
      if (value.length <= 80) lines.push(`${key}: ${value}`);
      else lines.push(`${key}: (${value.length} tegn – udeladt)`);
    } else if (Array.isArray(value)) {
      const scalars = value.filter((v) => typeof v === "string" || typeof v === "number");
      if (scalars.length === value.length && value.length <= 12) {
        lines.push(`${key}: ${scalars.join(", ")}`);
      } else {
        lines.push(`${key}: ${value.length} poster`);
      }
    } else {
      lines.push(`${key}: ${Object.keys(value as object).length} felter`);
    }
    if (lines.length >= 8) break;
  }
  return lines;
};

const hoursText = (hours: number | null | undefined) => {
  if (hours === null || hours === undefined || Number.isNaN(Number(hours))) return "ukendt";
  const h = Math.round(Number(hours) * 10) / 10;
  return `${h} ${h === 1 ? "time" : "timer"} siden`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let dryRun = false;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      dryRun = body?.dry_run === true;
    }

    // Beslutningen om, HVORNÅR der sendes, ligger udelukkende i basen.
    // Denne funktion adlyder send_mail og indeholder ingen egen betingelse.
    const { data: payloadRaw, error: payloadError } = await supabase.rpc(
      "compliance_mail_payload",
    );
    if (payloadError) throw payloadError;

    const payload = (payloadRaw ?? {}) as MailPayload;
    const grund = typeof payload.grund === "string" && payload.grund.trim()
      ? payload.grund.trim()
      : "ukendt årsag";

    if (payload.send_mail !== true) {
      console.log(`Ingen mail sendt (send_mail=false): ${grund}`);
      return new Response(
        JSON.stringify({ sent: false, send_mail: false, grund }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: recipientRows, error: recipientError } = await supabase
      .from("compliance_alert_recipients")
      .select("email, is_active")
      .eq("is_active", true);
    if (recipientError) throw recipientError;

    const recipients = (recipientRows ?? [])
      .map((r) => r.email)
      .filter((e): e is string => typeof e === "string" && e.includes("@"));

    const alerts = Array.isArray(payload.alarmer) ? payload.alarmer : [];
    const subject = `Stork compliance: ${grund}`;

    const alertHtml = alerts.length === 0
      ? `<p style="margin:16px 0;color:#374151;">Ingen alarmer i udtrækket.</p>`
      : alerts
        .map((a) => {
          const severity = String(a.alvor ?? "INFO");
          const color = SEVERITY_COLOR[severity] ?? "#374151";
          const maalt = a.maalt === null || a.maalt === undefined
            ? "—"
            : `${a.maalt}${a.graense === null || a.graense === undefined ? "" : ` mod grænse ${a.graense}`}`;
          const days = Number(a.aaben_i_dage ?? 0);
          const lines = detailLines(a.detaljer);
          return `<div style="border:1px solid #e5e7eb;border-left:4px solid ${color};border-radius:6px;padding:12px 14px;margin:10px 0;">
              <div style="font-weight:600;color:#111;">
                <span style="color:${color};">${escapeHtml(severity)}</span> · ${escapeHtml(String(a.titel ?? "Uden titel"))}
              </div>
              <div style="font-size:13px;color:#374151;margin-top:4px;">
                Målt værdi: ${escapeHtml(maalt)}<br>
                Åben i: ${escapeHtml(`${days} ${days === 1 ? "dag" : "dage"}`)}
              </div>
              ${lines.length
                ? `<div style="font-size:12px;color:#4b5563;margin-top:6px;">${lines.map((l) => escapeHtml(l)).join("<br>")}</div>`
                : ""}
            </div>`;
        })
        .join("");

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;background:#f5f5f5;padding:20px;">
        <div style="max-width:720px;margin:0 auto;background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
          <h2 style="margin:0;">Stork compliance-alarm</h2>
          <p style="color:#6b7280;margin:6px 0 16px;">Denne mail sendes kun, når kontrollen vurderer situationen som kritisk.</p>

          <div style="border-radius:6px;padding:12px 14px;background:#dc26261a;border:1px solid #dc2626;color:#111;font-weight:600;">
            ${escapeHtml(grund)}
          </div>

          <table style="width:100%;font-size:13px;color:#374151;margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0;">Åbne alarmer</td>
              <td style="padding:4px 0;text-align:right;">${escapeHtml(String(payload.aabne_i_alt ?? 0))} (heraf ${escapeHtml(String(payload.kritiske ?? 0))} kritiske)</td>
            </tr>
            <tr>
              <td style="padding:4px 0;">Seneste compliance-kørsel</td>
              <td style="padding:4px 0;text-align:right;">${escapeHtml(hoursText(payload.timer_siden_kontrol))}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;">Seneste GDPR-oprydning</td>
              <td style="padding:4px 0;text-align:right;">${escapeHtml(hoursText(payload.timer_siden_oprydning))}</td>
            </tr>
          </table>

          <h3 style="margin:20px 0 4px;">Alarmer</h3>
          ${alertHtml}

          <p style="margin-top:24px;">
            <a href="https://stork.copenhagensales.dk/compliance" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Åbn overvågningen i Stork</a>
          </p>
          <p style="font-size:11px;color:#9ca3af;margin-top:16px;">Mailen indeholder kun antal og feltnavne — aldrig kundedata.</p>
        </div>
      </body></html>`;

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          send_mail: true,
          subject,
          grund,
          recipients,
          alarmer: alerts.length,
          kritiske: payload.kritiske ?? 0,
          sent: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (recipients.length === 0) {
      console.error("Ingen aktive modtagere i compliance_alert_recipients — mail kunne ikke sendes");
      return new Response(
        JSON.stringify({ error: "Ingen aktive modtagere konfigureret", sent: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getM365AccessToken();
    await sendEmail(accessToken, recipients, subject, htmlBody);

    console.log(`Compliance-mail sendt til ${recipients.length} modtager(e): ${subject}`);
    return new Response(
      JSON.stringify({
        sent: true,
        subject,
        grund,
        recipients: recipients.length,
        alarmer: alerts.length,
        kritiske: payload.kritiske ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("send-compliance-alert error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
