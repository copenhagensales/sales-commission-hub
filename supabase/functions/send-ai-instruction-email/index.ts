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

function buildInstructionEmail(): string {
  return `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">

<div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px; color: white; margin-bottom: 24px;">
  <h1 style="margin: 0 0 8px 0; font-size: 22px;">🤖 AI-instruktion — Copenhagen Sales</h1>
  <p style="margin: 0; opacity: 0.9; font-size: 14px;">Vigtig information om brug af kunstig intelligens på arbejdspladsen</p>
</div>

<p style="font-size: 14px; line-height: 1.6;">
  Kære kollega,<br><br>
  I henhold til <strong>EU AI Act (Artikel 4)</strong> skal alle medarbejdere der bruger AI-værktøjer være instrueret i korrekt brug. 
  Denne mail udgør din formelle AI-instruktion.
</p>

<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h3 style="margin: 0 0 8px 0; color: #166534; font-size: 15px;">✅ Godkendte AI-systemer</h3>
  <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
    <li><strong>ChatGPT Business</strong> — Tekstudkast, opsummeringer, research (data deles IKKE med OpenAI)</li>
    <li><strong>Lovable</strong> — Intern systemudvikling (kun for systemadministratorer)</li>
  </ul>
  <p style="font-size: 12px; color: #166534; margin: 8px 0 0;">Andre AI-værktøjer må IKKE bruges til arbejdsopgaver uden godkendelse.</p>
</div>

<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 15px;">❌ Det må du IKKE</h3>
  <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
    <li>Indtaste CPR-numre, løndata eller bankoplysninger</li>
    <li>Bruge kunders persondata (navne, telefonnumre, adresser)</li>
    <li>Uploade fortrolige dokumenter</li>
    <li>Lade AI træffe beslutninger uden din godkendelse</li>
    <li>Bruge ikke-godkendte AI-værktøjer</li>
  </ul>
</div>

<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 15px;">📋 Vigtige regler</h3>
  <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
    <li>Gennemgå og ret <strong>altid</strong> AI-output inden brug</li>
    <li>AI er et støtteværktøj — du er ansvarlig for resultatet</li>
    <li>Anonymiser data inden brug i AI når muligt</li>
    <li>Rapportér fejl eller tvivl til AI-ansvarlig (Kasper Mikkelsen)</li>
  </ul>
</div>

<p style="font-size: 13px; color: #6b7280; line-height: 1.6; margin-top: 24px;">
  Den fulde AI-politik og yderligere dokumentation finder du i compliance-sektionen i systemet under "AI Governance".
</p>

<div style="border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 16px;">
  <p style="font-size: 11px; color: #9ca3af; margin: 0;">
    Denne mail er sendt automatisk som del af Copenhagen Sales' compliance med EU AI Act.<br>
    AI-ansvarlig: Kasper Mikkelsen · Sendt fra Copenhagen Sales Compliance
  </p>
</div>

</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check owner
    const { data: isOwner } = await supabase.rpc("is_owner", { _user_id: user.id });
    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Forbidden: owner only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body for employee_ids
    const body = await req.json().catch(() => ({}));
    const employeeIds: string[] | undefined = body.employee_ids;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return new Response(JSON.stringify({ error: "employee_ids array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get selected employees with work email
    const { data: employees, error: empError } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name, work_email")
      .in("id", employeeIds)
      .eq("is_active", true)
      .not("work_email", "is", null);

    if (empError) throw empError;

    const validEmployees = (employees || []).filter((e: any) => e.work_email && e.work_email.trim());
    if (validEmployees.length === 0) {
      return new Response(JSON.stringify({ error: "No valid employees found with work email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via M365
    const accessToken = await getM365AccessToken();
    const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
    if (!senderEmail) throw new Error("Missing M365_SENDER_EMAIL");

    const htmlBody = buildInstructionEmail();
    const recipientEmails = validEmployees.map((e: any) => e.work_email);

    // Send in batches of 50
    const batchSize = 50;
    for (let i = 0; i < recipientEmails.length; i += batchSize) {
      const batch = recipientEmails.slice(i, i + batchSize);
      const toRecipients = batch.map((email: string) => ({
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
              subject: "🤖 AI-instruktion — Vigtig information om brug af AI (EU AI Act)",
              body: { contentType: "HTML", content: htmlBody },
              toRecipients,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`M365 send error batch ${i}:`, errorText);
        throw new Error(`Failed to send email batch: ${response.status}`);
      }
    }

    // Log each employee
    const logEntries = validEmployees.map((e: any) => ({
      employee_id: e.id,
      employee_name: `${e.first_name} ${e.last_name}`,
      employee_email: e.work_email,
      instruction_date: new Date().toISOString(),
      method: "email",
      acknowledged: false,
      notes: "AI-instruktionsmail sendt via M365 Graph API",
    }));

    const { error: logError } = await supabase.from("ai_instruction_log").insert(logEntries);
    if (logError) {
      console.error("Failed to log instructions:", logError);
    }

    return new Response(
      JSON.stringify({ success: true, sent_count: validEmployees.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
