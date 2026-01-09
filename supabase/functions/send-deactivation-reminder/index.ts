import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeactivationReminderRequest {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  team_id: string | null;
  team_name: string;
  recipients: string[];
  is_followup?: boolean;
}

// Get M365 access token
async function getM365AccessToken(): Promise<string> {
  const tenantId = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("M365 credentials not configured");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("M365 token error:", error);
    throw new Error("Failed to get M365 access token");
  }

  const data = await response.json();
  return data.access_token;
}

// Send email via M365
async function sendEmail(
  accessToken: string,
  recipients: string[],
  subject: string,
  htmlBody: string
): Promise<void> {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  
  if (!senderEmail) {
    throw new Error("M365_SENDER_EMAIL not configured");
  }

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
          toRecipients: recipients.map(email => ({ emailAddress: { address: email } })),
        },
        saveToSentItems: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("M365 send email error:", error);
    throw new Error("Failed to send email via M365");
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: DeactivationReminderRequest = await req.json();
    const { 
      employee_id, 
      employee_name, 
      employee_email, 
      team_id, 
      team_name, 
      recipients,
      is_followup = false 
    } = body;

    console.log(`Processing deactivation reminder for ${employee_name} (followup: ${is_followup})`);

    if (!recipients || recipients.length === 0) {
      throw new Error("No recipients specified");
    }

    // Get the email template - try team-specific first, fall back to default
    let config: { email_subject: string; email_body: string } | null = null;
    
    if (team_id) {
      const { data: teamConfig } = await supabase
        .from("deactivation_reminder_config")
        .select("email_subject, email_body")
        .eq("team_id", team_id)
        .single();
      config = teamConfig;
    }
    
    // If no team-specific config, use a default template
    if (!config) {
      config = {
        email_subject: "Medarbejder deaktiveret - Handling påkrævet",
        email_body: `Kære modtager,

En medarbejder er blevet deaktiveret i systemet.

Medarbejder: {{employee_name}}
Team: {{team_name}}
Email: {{employee_email}}
Dato: {{deactivation_date}}

Venligst sørg for at følgende opgaver udføres:
- Fjern adgange til systemer
- Opdater relevante lister
- Informer relevante parter

Med venlig hilsen,
CPH Sales System`,
      };
    }

    const deactivationDate = new Date().toLocaleDateString("da-DK", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Replace placeholders in email body
    let emailBody = config.email_body
      .replace(/\{\{employee_name\}\}/g, employee_name)
      .replace(/\{\{team_name\}\}/g, team_name)
      .replace(/\{\{employee_email\}\}/g, employee_email || "Ikke angivet")
      .replace(/\{\{deactivation_date\}\}/g, deactivationDate);

    // Modify subject for followup
    let emailSubject = config.email_subject;
    if (is_followup) {
      emailSubject = `OPFØLGNING: ${emailSubject}`;
      emailBody = `⚠️ PÅMINDELSE - Denne handling er stadig ikke udført!\n\n${emailBody}`;
    }

    // Convert plain text to HTML
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${is_followup ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
          .checklist { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">${is_followup ? '⚠️ OPFØLGNING: ' : ''}Medarbejder Deaktiveret</h2>
          </div>
          <div class="content">
            <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${emailBody}</pre>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via M365
    console.log(`Sending deactivation reminder to ${recipients.length} recipients via M365`);
    const accessToken = await getM365AccessToken();
    await sendEmail(accessToken, recipients, emailSubject, htmlBody);

    console.log(`Deactivation reminder sent successfully to ${recipients.length} recipients`);

    // Track the sent reminder
    if (!is_followup) {
      // Create initial tracking record
      await supabase.from("deactivation_reminders_sent").insert({
        employee_id,
        team_id,
        recipients,
        initial_sent_at: new Date().toISOString(),
      });
    } else {
      // Update followup timestamp
      await supabase
        .from("deactivation_reminders_sent")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("employee_id", employee_id)
        .is("followup_sent_at", null);
    }

    return new Response(
      JSON.stringify({ success: true, recipientCount: recipients.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-deactivation-reminder:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
