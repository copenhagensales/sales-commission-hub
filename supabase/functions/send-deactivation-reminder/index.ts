import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeactivationReminderRequest {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  team_id: string;
  team_name: string;
  recipients: string[];
  is_followup?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
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

    // Get the email template for this team
    const { data: config, error: configError } = await supabase
      .from("deactivation_reminder_config")
      .select("email_subject, email_body")
      .eq("team_id", team_id)
      .single();

    if (configError) {
      console.error("Failed to get config:", configError);
      throw new Error("Could not find email template for team");
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

    // Send email to all recipients
    const { error: emailError } = await resend.emails.send({
      from: "CPH Sales <noreply@cph.sales>",
      to: recipients,
      subject: emailSubject,
      html: htmlBody,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

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
