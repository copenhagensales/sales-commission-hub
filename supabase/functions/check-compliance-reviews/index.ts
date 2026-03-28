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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get notification recipients
    const { data: recipientRows, error: recipientError } = await supabase
      .from("compliance_notification_recipients")
      .select("employee_id");

    if (recipientError) throw recipientError;
    if (!recipientRows?.length) {
      console.log("No compliance notification recipients configured");
      return new Response(JSON.stringify({ message: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get recipient emails
    const employeeIds = recipientRows.map((r) => r.employee_id);
    const { data: employees } = await supabase
      .from("agents")
      .select("email")
      .in("id", employeeIds)
      .eq("is_active", true);

    const recipientEmails = (employees ?? [])
      .map((e) => e.email)
      .filter(Boolean);

    if (!recipientEmails.length) {
      console.log("No active recipient emails found");
      return new Response(JSON.stringify({ message: "No active recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Collect GDPR-relevant items that need attention
    const alerts: string[] = [];

    // Check for pending absence requests (data subject requests could be tracked here)
    // Check for any compliance-related deadlines
    // For now, this is a weekly health-check reminder
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysFromNow = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];

    // Example: check if any AMO documents are expiring soon
    const { data: expiringDocs } = await supabase
      .from("amo_documents")
      .select("title, expiry_date")
      .gte("expiry_date", today)
      .lte("expiry_date", thirtyDaysFromNow);

    if (expiringDocs?.length) {
      alerts.push(
        `<li><strong>${expiringDocs.length} dokument(er)</strong> udløber inden for 30 dage</li>`
      );
    }

    // Check APV deadlines
    const { data: apvDeadlines } = await supabase
      .from("amo_apv")
      .select("title, deadline")
      .gte("deadline", today)
      .lte("deadline", thirtyDaysFromNow)
      .is("completed_date", null);

    if (apvDeadlines?.length) {
      alerts.push(
        `<li><strong>${apvDeadlines.length} APV</strong> har deadline inden for 30 dage</li>`
      );
    }

    // Check overdue tasks
    const { data: overdueTasks } = await supabase
      .from("amo_tasks")
      .select("title, due_date")
      .lt("due_date", today)
      .neq("status", "done");

    if (overdueTasks?.length) {
      alerts.push(
        `<li><strong>${overdueTasks.length} opgave(r)</strong> er overskredet</li>`
      );
    }

    if (!alerts.length) {
      console.log("No compliance alerts to send");
      return new Response(
        JSON.stringify({ message: "No alerts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Send email
    const accessToken = await getM365AccessToken();
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">🔒 Ugentlig compliance-oversigt</h2>
        <p style="color: #555;">Følgende punkter kræver opmærksomhed:</p>
        <ul style="color: #333; line-height: 1.8;">
          ${alerts.join("")}
        </ul>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">
          Denne email sendes automatisk hver uge til compliance-modtagere.
          Log ind i systemet for at se detaljer.
        </p>
      </div>
    `;

    await sendEmail(
      accessToken,
      recipientEmails,
      "Ugentlig compliance-oversigt – GDPR påmindelse",
      htmlBody
    );

    console.log(`Compliance email sent to ${recipientEmails.length} recipients`);

    return new Response(
      JSON.stringify({
        message: "Email sent",
        recipients: recipientEmails.length,
        alerts: alerts.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-compliance-reviews error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
