import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log("Starting deactivation followup check...");

    // Find reminders sent yesterday that haven't had followup
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
    const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();

    const { data: pendingFollowups, error: fetchError } = await supabase
      .from("deactivation_reminders_sent")
      .select(`
        id,
        employee_id,
        team_id,
        recipients,
        employee_master_data!inner(first_name, last_name, work_email, private_email),
        teams(name)
      `)
      .gte("initial_sent_at", yesterdayStart)
      .lte("initial_sent_at", yesterdayEnd)
      .is("followup_sent_at", null);

    if (fetchError) {
      console.error("Failed to fetch pending followups:", fetchError);
      throw new Error("Could not fetch pending followups");
    }

    console.log(`Found ${pendingFollowups?.length || 0} pending followups`);

    // Get owner emails to exclude from followups (owners only receive initial email)
    const { data: ownerData } = await supabase
      .from("employee_master_data")
      .select("work_email")
      .eq("job_title", "Ejer")
      .eq("is_active", true)
      .neq("first_name", "Angel");
    
    const ownerEmails = new Set((ownerData || []).map(o => o.work_email).filter(Boolean));
    console.log(`Excluding ${ownerEmails.size} owner emails from followups`);

    // Get M365 access token once for all emails
    const accessToken = await getM365AccessToken();

    let sentCount = 0;

    for (const reminder of pendingFollowups || []) {
      const employeeData = reminder.employee_master_data as unknown as { first_name: string; last_name: string; work_email: string | null; private_email: string | null };
      const teamData = reminder.teams as unknown as { name: string } | null;
      // Get the email template for this team
      const { data: config, error: configError } = await supabase
        .from("deactivation_reminder_config")
        .select("email_subject, email_body")
        .eq("team_id", reminder.team_id)
        .single();

      if (configError || !config) {
        console.error(`No config found for team ${reminder.team_id}, skipping`);
        continue;
      }

      const deactivationDate = new Date().toLocaleDateString("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      // Replace placeholders in email body
      let emailBody = config.email_body
        .replace(/\{\{employee_name\}\}/g, `${employeeData.first_name} ${employeeData.last_name}`)
        .replace(/\{\{team_name\}\}/g, teamData?.name || "Ukendt team")
        .replace(/\{\{employee_email\}\}/g, employeeData.work_email || employeeData.private_email || "Ikke angivet")
        .replace(/\{\{deactivation_date\}\}/g, deactivationDate);

      // Add followup prefix
      const emailSubject = `OPFØLGNING: ${config.email_subject}`;
      emailBody = `⚠️ PÅMINDELSE - Denne handling er stadig ikke udført!\n\n${emailBody}`;

      // Convert plain text to HTML
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
            .checklist { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">⚠️ OPFØLGNING: Medarbejder Deaktiveret</h2>
            </div>
            <div class="content">
              <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${emailBody}</pre>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send email to all recipients, excluding owners (they only get initial email)
      const allRecipients = reminder.recipients as string[];
      const recipients = allRecipients.filter(email => !ownerEmails.has(email));
      
      if (recipients.length === 0) {
        console.log(`No non-owner recipients for ${reminder.id}, skipping followup`);
        // Still mark as sent so we don't keep trying
        await supabase
          .from("deactivation_reminders_sent")
          .update({ followup_sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
        continue;
      }
      
      try {
        await sendEmail(accessToken, recipients, emailSubject, htmlBody);
      } catch (emailError) {
        console.error(`Failed to send followup for ${reminder.id}:`, emailError);
        continue;
      }

      // Update followup timestamp
      await supabase
        .from("deactivation_reminders_sent")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", reminder.id);

      sentCount++;
      console.log(`Sent followup for employee ${employeeData.first_name} ${employeeData.last_name}`);
    }

    console.log(`Completed: sent ${sentCount} followup emails`);

    return new Response(
      JSON.stringify({ success: true, sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-deactivation-followups:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
