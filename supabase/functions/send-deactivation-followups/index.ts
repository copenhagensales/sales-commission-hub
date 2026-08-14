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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting deactivation followup check...");

    // All behaviour is driven by the central settings row — nothing hardcoded
    const { data: settings } = await supabase
      .from("deactivation_notification_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const followupEnabled = settings?.followup_enabled ?? true;
    const delayHours = settings?.followup_delay_hours ?? 24;
    const excludeOwners = settings?.followup_exclude_owners ?? true;
    const emailSubject = settings?.email_subject ?? "Medarbejder deaktiveret - Handling påkrævet";
    const emailTemplate = settings?.email_body ?? "";
    const excludedEmails: string[] = settings?.excluded_emails ?? [];

    if (!followupEnabled) {
      console.log("Followups disabled in settings — nothing to do");
      return new Response(JSON.stringify({ success: true, sentCount: 0, skipped: "disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dueBefore = new Date(Date.now() - delayHours * 60 * 60 * 1000).toISOString();
    const notOlderThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

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
      .eq("status", "sent")
      .eq("is_test", false)
      .lte("initial_sent_at", dueBefore)
      .gte("initial_sent_at", notOlderThan)
      .is("followup_sent_at", null);

    if (fetchError) {
      console.error("Failed to fetch pending followups:", fetchError);
      throw new Error("Could not fetch pending followups");
    }

    console.log(`Found ${pendingFollowups?.length || 0} pending followups`);

    const skipEmails = new Set(excludedEmails.map((e) => (e || "").trim().toLowerCase()).filter(Boolean));
    if (excludeOwners) {
      const { data: ownerData } = await supabase
        .from("employee_master_data")
        .select("work_email, private_email")
        .eq("job_title", "Ejer")
        .eq("is_active", true);
      (ownerData || []).forEach((o) => {
        const email = (o.work_email || o.private_email || "").trim().toLowerCase();
        if (email) skipEmails.add(email);
      });
    }

    const accessToken = await getM365AccessToken();
    let sentCount = 0;

    for (const reminder of pendingFollowups || []) {
      const employeeData = reminder.employee_master_data as unknown as {
        first_name: string;
        last_name: string;
        work_email: string | null;
        private_email: string | null;
      };
      const teamData = reminder.teams as unknown as { name: string } | null;

      const deactivationDate = new Date().toLocaleDateString("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      let emailBody = emailTemplate
        .replace(/\{\{employee_name\}\}/g, `${employeeData.first_name} ${employeeData.last_name}`)
        .replace(/\{\{team_name\}\}/g, teamData?.name || "Ingen team")
        .replace(/\{\{employee_email\}\}/g, employeeData.work_email || employeeData.private_email || "Ikke angivet")
        .replace(/\{\{deactivation_date\}\}/g, deactivationDate)
        .replace(/\{\{actor_name\}\}/g, "System");

      emailBody = `⚠️ PÅMINDELSE - Denne handling er stadig ikke udført!\n\n${emailBody}`;
      const subject = `OPFØLGNING: ${emailSubject}`;

      const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1f2937;max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#dc2626;color:#ffffff;padding:20px 24px;border-radius:10px 10px 0 0;">
      <h2 style="margin:0;font-size:18px;letter-spacing:0.02em;">OPFØLGNING: Medarbejder deaktiveret</h2>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
      <pre style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:14px;">${escapeHtml(emailBody)}</pre>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Automatisk besked fra Stork · Copenhagen Sales</p>
  </div>
</body>
</html>`;

      const allRecipients = (reminder.recipients as string[]) || [];
      const recipients = allRecipients.filter((email) => !skipEmails.has((email || "").trim().toLowerCase()));

      if (recipients.length === 0) {
        console.log(`No eligible recipients for ${reminder.id}, marking as handled`);
        await supabase
          .from("deactivation_reminders_sent")
          .update({ followup_sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
        continue;
      }

      try {
        await sendEmail(accessToken, recipients, subject, htmlBody);
      } catch (emailError) {
        console.error(`Failed to send followup for ${reminder.id}:`, emailError);
        continue;
      }

      await supabase
        .from("deactivation_reminders_sent")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", reminder.id);

      sentCount++;
      console.log(`Sent followup for ${employeeData.first_name} ${employeeData.last_name}`);
    }

    console.log(`Completed: sent ${sentCount} followup emails`);

    return new Response(JSON.stringify({ success: true, sentCount }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-deactivation-followups:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

