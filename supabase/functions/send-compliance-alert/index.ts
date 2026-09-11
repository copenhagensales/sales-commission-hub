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

interface AlertRow {
  id: string;
  check_key: string;
  severity: string;
  title: string;
  detail: Record<string, unknown> | null;
  observed_value: number | null;
  threshold: number | null;
  status: string;
  first_seen: string;
  last_seen: string;
  note: string | null;
}

const SEVERITY_ORDER: Record<string, number> = { KRITISK: 0, HOEJ: 1, MIDDEL: 2, INFO: 3 };

const SEVERITY_COLOR: Record<string, string> = {
  KRITISK: "#dc2626",
  HOEJ: "#ea580c",
  MIDDEL: "#ca8a04",
  INFO: "#2563eb",
};

const daFormat = (iso: string | null | undefined) => {
  if (!iso) return "ukendt";
  return new Date(iso).toLocaleString("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ageText = (firstSeen: string) => {
  const ms = Date.now() - new Date(firstSeen).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? "dag" : "dage"}`;
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  return `${hours} ${hours === 1 ? "time" : "timer"}`;
};

/**
 * Detail-felter vises kun som navn + tal/kort tekst. Objekter og lange
 * strenge udelades, så ingen kundedata kan slippe med i mailen.
 */
const detailLines = (detail: Record<string, unknown> | null): string[] => {
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

    const [{ data: recipientRows, error: recipientError }, alertsRes, runRes, gdprRes] =
      await Promise.all([
        supabase
          .from("compliance_alert_recipients")
          .select("email, is_active")
          .eq("is_active", true),
        supabase
          .from("compliance_alerts")
          .select(
            "id, check_key, severity, title, detail, observed_value, threshold, status, first_seen, last_seen, note",
          )
          .in("status", ["open", "acknowledged"]),
        supabase
          .from("compliance_check_runs")
          .select("run_at, open_alerts, critical_alerts, triggered_by")
          .order("run_at", { ascending: false })
          .limit(1),
        supabase
          .from("gdpr_cleanup_log")
          .select("run_at, action, records_affected")
          .order("run_at", { ascending: false })
          .limit(1),
      ]);

    if (recipientError) throw recipientError;
    if (alertsRes.error) throw alertsRes.error;

    const recipients = (recipientRows ?? [])
      .map((r) => r.email)
      .filter((e): e is string => typeof e === "string" && e.includes("@"));

    const alerts = ((alertsRes.data ?? []) as AlertRow[]).sort((a, b) => {
      const sa = SEVERITY_ORDER[a.severity] ?? 9;
      const sb = SEVERITY_ORDER[b.severity] ?? 9;
      if (sa !== sb) return sa - sb;
      return new Date(a.first_seen).getTime() - new Date(b.first_seen).getTime();
    });

    const openAlerts = alerts.filter((a) => a.status === "open");
    const criticalCount = openAlerts.filter((a) => a.severity === "KRITISK").length;
    const lastRun = runRes.data?.[0] ?? null;
    const lastGdpr = gdprRes.data?.[0] ?? null;

    const subject = openAlerts.length === 0
      ? "Stork compliance: alt i orden"
      : `Stork compliance: ${openAlerts.length} afvigelser (${criticalCount} kritiske)`;

    const statusColor = openAlerts.length === 0
      ? "#16a34a"
      : criticalCount > 0
        ? "#dc2626"
        : "#ca8a04";

    const statusText = openAlerts.length === 0
      ? "Ingen åbne afvigelser. Alle kontroller er grønne."
      : `${openAlerts.length} åbne afvigelser, heraf ${criticalCount} kritiske.`;

    const alertHtml = alerts.length === 0
      ? `<p style="margin:16px 0;color:#374151;">Der er ingen åbne eller kvitterede alarmer.</p>`
      : alerts
        .map((a) => {
          const color = SEVERITY_COLOR[a.severity] ?? "#374151";
          const maalt = a.observed_value === null
            ? "—"
            : `${a.observed_value}${a.threshold === null ? "" : ` mod grænse ${a.threshold}`}`;
          const lines = detailLines(a.detail);
          const kvitteret = a.status === "acknowledged"
            ? `<div style="font-size:12px;color:#6b7280;margin-top:6px;">Kvitteret${a.note ? `: ${escapeHtml(a.note)}` : ""}</div>`
            : "";
          return `<div style="border:1px solid #e5e7eb;border-left:4px solid ${color};border-radius:6px;padding:12px 14px;margin:10px 0;${a.status === "acknowledged" ? "opacity:0.65;" : ""}">
              <div style="font-weight:600;color:#111;">
                <span style="color:${color};">${escapeHtml(a.severity)}</span> · ${escapeHtml(a.title)}
              </div>
              <div style="font-size:13px;color:#374151;margin-top:4px;">
                Kontrol: ${escapeHtml(a.check_key)}<br>
                Målt værdi: ${escapeHtml(maalt)}<br>
                Åben i: ${escapeHtml(ageText(a.first_seen))} (første gang ${escapeHtml(daFormat(a.first_seen))})
              </div>
              ${lines.length
                ? `<div style="font-size:12px;color:#4b5563;margin-top:6px;">${lines.map((l) => escapeHtml(l)).join("<br>")}</div>`
                : ""}
              ${kvitteret}
            </div>`;
        })
        .join("");

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;background:#f5f5f5;padding:20px;">
        <div style="max-width:720px;margin:0 auto;background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
          <h2 style="margin:0;">Stork compliance-overvågning</h2>
          <p style="color:#6b7280;margin:6px 0 16px;">Daglig status. Denne mail sendes hver dag — udebliver den, er selve overvågningen nede.</p>

          <div style="border-radius:6px;padding:12px 14px;background:${statusColor}1a;border:1px solid ${statusColor};color:#111;font-weight:600;">
            ${escapeHtml(statusText)}
          </div>

          <table style="width:100%;font-size:13px;color:#374151;margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0;">Seneste compliance-kørsel</td>
              <td style="padding:4px 0;text-align:right;">${escapeHtml(daFormat(lastRun?.run_at))}${lastRun?.triggered_by ? ` (${escapeHtml(String(lastRun.triggered_by))})` : ""}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;">Seneste GDPR-oprydning</td>
              <td style="padding:4px 0;text-align:right;">${escapeHtml(daFormat(lastGdpr?.run_at))}${lastGdpr?.action ? ` (${escapeHtml(String(lastGdpr.action))})` : ""}</td>
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
          subject,
          recipients,
          open_alerts: openAlerts.length,
          critical_alerts: criticalCount,
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
        recipients: recipients.length,
        open_alerts: openAlerts.length,
        critical_alerts: criticalCount,
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
