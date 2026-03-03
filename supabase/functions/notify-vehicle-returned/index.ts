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
    throw new Error("Missing M365 credentials");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token error:", error);
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendEmail(accessToken: string, recipients: string[], subject: string, htmlBody: string): Promise<void> {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  if (!senderEmail) throw new Error("Missing M365_SENDER_EMAIL");

  const toRecipients = recipients.map(email => ({
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
    console.error("Send email error:", error);
    throw new Error(`Failed to send email: ${response.status}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employee_name, vehicle_name, booking_date } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find FM leaders to notify
    const { data: fmLeaders } = await supabase
      .from("employee_master_data")
      .select("work_email, private_email, first_name")
      .or("job_title.ilike.%fieldmarketing leder%,job_title.ilike.Assisterende Teamleder FM")
      .eq("is_active", true);

    const recipientEmails = (fmLeaders ?? [])
      .map((l: any) => l.work_email || l.private_email)
      .filter(Boolean);

    if (recipientEmails.length === 0) {
      console.warn("No FM leaders found to notify");
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getM365AccessToken();

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #b45309;">🚗 Bil afleveret</h2>
        <p><strong>${employee_name}</strong> har bekræftet aflevering af <strong>${vehicle_name}</strong>.</p>
        <p>Dato: <strong>${booking_date}</strong></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="font-size: 12px; color: #6b7280;">Denne email er sendt automatisk fra Copenhagen Sales vagtplan.</p>
      </div>
    `;

    await sendEmail(accessToken, recipientEmails, `Bil afleveret: ${vehicle_name} (${booking_date})`, htmlBody);

    return new Response(JSON.stringify({ ok: true, notified: recipientEmails.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
