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

const statusLabels: Record<string, string> = {
  new: "Ny",
  seen: "Set",
  in_progress: "Under arbejde",
  resolved: "Løst",
  wont_fix: "Afvist",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { feedbackTitle, newStatus, adminNotes, employeeEmail, employeeName } = body;

    if (!feedbackTitle || !newStatus || !employeeEmail) {
      return new Response(JSON.stringify({ error: "feedbackTitle, newStatus, and employeeEmail are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusLabel = statusLabels[newStatus] || newStatus;

    const notesRow = adminNotes
      ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#374151;vertical-align:top;">Kommentar fra admin</td><td style="padding:8px 12px;">${adminNotes.replace(/\n/g, "<br>")}</td></tr>`
      : "";

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a365d;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">📋 Opdatering på din indrapportering</h2>
        </div>
        <div style="padding:20px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <p style="font-size:14px;color:#374151;">Hej ${employeeName || ""},</p>
          <p style="font-size:14px;color:#374151;">Din indrapportering er blevet opdateret.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;width:140px;">Titel</td><td style="padding:8px 12px;">${feedbackTitle}</td></tr>
            <tr><td style="padding:8px 12px;font-weight:bold;color:#374151;">Ny status</td><td style="padding:8px 12px;"><strong style="color:#1a365d;">${statusLabel}</strong></td></tr>
            ${notesRow}
          </table>
          <p style="margin-top:16px;font-size:13px;color:#6b7280;">Denne email er sendt automatisk fra Copenhagen Sales.</p>
        </div>
      </div>`;

    const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
    if (!senderEmail) throw new Error("Missing M365_SENDER_EMAIL");

    const accessToken = await getM365AccessToken();

    const emailPayload = {
      message: {
        subject: `Din indrapportering er opdateret: ${feedbackTitle}`,
        body: { contentType: "HTML", content: htmlBody },
        toRecipients: [
          { emailAddress: { address: employeeEmail } },
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
      throw new Error("Failed to send status change notification");
    }

    console.log(`Feedback status change notification sent to ${employeeEmail}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-feedback-status-change error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
