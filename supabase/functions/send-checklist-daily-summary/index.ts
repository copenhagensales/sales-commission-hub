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

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing M365 credentials");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("M365 token error:", error);
    throw new Error("Failed to get M365 access token");
  }

  const data = await response.json();
  return data.access_token;
}

async function sendEmail(
  accessToken: string,
  recipients: string[],
  subject: string,
  htmlBody: string
): Promise<void> {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  if (!senderEmail) throw new Error("Missing M365_SENDER_EMAIL");

  const toRecipients = recipients.map((email) => ({
    emailAddress: { address: email },
  }));

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: htmlBody },
          toRecipients,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Email send error:", error);
    throw new Error("Failed to send email");
  }
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    // 1. Get config
    const { data: configRows, error: configError } = await supabase
      .from("fm_checklist_email_config")
      .select("*")
      .limit(1);

    if (configError) throw configError;
    const config = configRows?.[0];

    if (!config) {
      return new Response(JSON.stringify({ message: "No config found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip is_active check if force=true
    if (!force && !config.is_active) {
      return new Response(JSON.stringify({ message: "Email sending is disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get recipients (emails stored directly)
    const { data: recipientRows } = await supabase
      .from("fm_checklist_email_recipients")
      .select("email");

    if (!recipientRows?.length) {
      return new Response(JSON.stringify({ message: "No recipients configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientEmails = recipientRows.map((r: any) => r.email).filter(Boolean);

    if (!recipientEmails.length) {
      return new Response(JSON.stringify({ message: "No active recipient emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get today's data
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    // JS getDay: 0=Sun. Convert to Mon=0
    const jsDow = now.getDay();
    const weekdayIndex = jsDow === 0 ? 6 : jsDow - 1;

    // Get active templates for today's weekday
    const { data: allTemplates } = await supabase
      .from("fm_checklist_templates")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const todayTemplates = (allTemplates ?? []).filter((t: any) =>
      t.weekdays?.includes(weekdayIndex)
    );

    if (!todayTemplates.length) {
      return new Response(JSON.stringify({ message: "No tasks scheduled for today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get completions for today
    const { data: completions } = await supabase
      .from("fm_checklist_completions")
      .select("*")
      .eq("completed_date", todayStr);

    const completionMap = new Map<string, any>();
    (completions ?? []).forEach((c: any) => {
      completionMap.set(c.template_id, c);
    });

    // 4. Build HTML
    const doneCount = todayTemplates.filter((t: any) => completionMap.has(t.id)).length;
    const totalCount = todayTemplates.length;
    const pct = Math.round((doneCount / totalCount) * 100);

    const taskRows = todayTemplates
      .map((t: any) => {
        const completion = completionMap.get(t.id);
        const status = completion ? "✅" : "❌";
        const noteHtml = completion?.note
          ? `<br/><span style="color:#888;font-size:12px;">📝 ${completion.note}</span>`
          : "";
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:20px;text-align:center;">${status}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">
            <strong>${t.title}</strong>
            ${t.description ? `<br/><span style="color:#888;font-size:12px;">${t.description}</span>` : ""}
            ${noteHtml}
          </td>
        </tr>`;
      })
      .join("");

    const progressColor = pct === 100 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">📋 FM Checkliste — ${DAY_NAMES[weekdayIndex]} ${todayStr}</h2>
        
        <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:32px;font-weight:bold;color:${progressColor};">${pct}%</span>
            <span style="color:#555;">${doneCount} af ${totalCount} opgaver udført</span>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:8px 12px;text-align:center;width:50px;">Status</th>
              <th style="padding:8px 12px;text-align:left;">Opgave</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows}
          </tbody>
        </table>

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p style="color:#999;font-size:12px;">
          Denne email sendes automatisk dagligt. Log ind i systemet for at se detaljer.
        </p>
      </div>
    `;

    // 5. Send email
    const accessToken = await getM365AccessToken();
    await sendEmail(
      accessToken,
      recipientEmails,
      `FM Checkliste — ${DAY_NAMES[weekdayIndex]} — ${pct}% udført`,
      htmlBody
    );

    console.log(`Checklist summary sent to ${recipientEmails.length} recipients`);

    return new Response(
      JSON.stringify({
        message: "Email sent",
        recipients: recipientEmails.length,
        tasks: totalCount,
        completed: doneCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-checklist-daily-summary error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
