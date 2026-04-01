import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getM365AccessToken(): Promise<string> {
  const tenantId = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) throw new Error("Missing M365 credentials");

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }
  );
  if (!res.ok) throw new Error(`M365 token error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { title, category, priority, description, affectedEmployee, systemArea, submittedBy } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoryLabels: Record<string, string> = {
      bug: "Fejl / Bug",
      improvement: "Forbedring",
      feature_request: "Ny funktion",
    };

    const priorityLabels: Record<string, string> = {
      critical: "Kritisk",
      high: "Høj",
      medium: "Medium",
      low: "Lav",
    };

    const priorityColors: Record<string, string> = {
      critical: "#ef4444",
      high: "#f97316",
      medium: "#eab308",
      low: "#6b7280",
    };

    const rows = [
      `<tr><td style="padding:8px 12px;font-weight:bold;color:#374151;width:140px;">Overskrift</td><td style="padding:8px 12px;">${title}</td></tr>`,
      `<tr><td style="padding:8px 12px;font-weight:bold;color:#374151;">Kategori</td><td style="padding:8px 12px;">${categoryLabels[category] || category}</td></tr>`,
      `<tr><td style="padding:8px 12px;font-weight:bold;color:#374151;">Prioritet</td><td style="padding:8px 12px;"><span style="color:${priorityColors[priority] || '#6b7280'};font-weight:bold;">${priorityLabels[priority] || priority}</span></td></tr>`,
      affectedEmployee ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#374151;">Berørt medarbejder</td><td style="padding:8px 12px;">${affectedEmployee}</td></tr>` : "",
      systemArea ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#374151;">Systemområde</td><td style="padding:8px 12px;">${systemArea}</td></tr>` : "",
      description ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#374151;vertical-align:top;">Beskrivelse</td><td style="padding:8px 12px;">${description.replace(/\n/g, "<br>")}</td></tr>` : "",
      submittedBy ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#374151;">Indsendt af</td><td style="padding:8px 12px;">${submittedBy}</td></tr>` : "",
    ].filter(Boolean).join("");

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a365d;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">🐛 Ny system-indrapportering</h2>
        </div>
        <div style="padding:20px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <table style="width:100%;border-collapse:collapse;">${rows}</table>
          <p style="margin-top:16px;font-size:13px;color:#6b7280;">Denne email er sendt automatisk fra Copenhagen Sales.</p>
        </div>
      </div>`;

    const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
    if (!senderEmail) throw new Error("Missing M365_SENDER_EMAIL");

    const accessToken = await getM365AccessToken();

    const emailPayload = {
      message: {
        subject: `Ny indrapportering: ${title}`,
        body: { contentType: "HTML", content: htmlBody },
        toRecipients: [
          { emailAddress: { address: "mg@copenhagensales.dk" } },
          { emailAddress: { address: "km@copenhagensales.dk" } },
        ],
      },
      saveToSentItems: false,
    };

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Email send failed:", err);
      throw new Error("Failed to send notification email");
    }

    console.log("System feedback notification sent");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-system-feedback error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
