import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    throw new Error("Failed to get M365 access token");
  }

  const data = await response.json();
  return data.access_token;
}

// Send email via Microsoft Graph API
async function sendEmail(
  accessToken: string,
  to: string,
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
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Send email error:", error);
    throw new Error("Failed to send email");
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Dry run: report which contracts would be hit without sending anything
    let dryRun = false;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        dryRun = body?.dry_run === true;
      }
    } catch (_) {
      dryRun = false;
    }

    // Rule configuration lives in contract_policy_settings (managed under
    // Kontrakter → Regler). Defaults below are identical to the previously
    // hardcoded behaviour and apply if the settings cannot be read.
    const DEFAULTS = { first_after_days: 3, interval_days: 3, max_reminders: 3 };
    const { data: policyRow, error: policyError } = await supabase
      .from("contract_policy_settings")
      .select("enabled, config")
      .eq("key", "employee_reminder")
      .maybeSingle();

    if (policyError) {
      console.error("Could not read contract policy, using defaults:", policyError);
    }

    if (policyRow && policyRow.enabled === false) {
      console.log("Contract reminder rule is disabled — skipping");
      return new Response(
        JSON.stringify({ message: "Reminder rule disabled", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfg = { ...DEFAULTS, ...((policyRow?.config as Record<string, number>) ?? {}) };
    const clamp = (v: unknown, min: number, max: number, fallback: number) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, Math.round(n)));
    };
    const firstAfterDays = clamp(cfg.first_after_days, 1, 60, DEFAULTS.first_after_days);
    const intervalDays = clamp(cfg.interval_days, 1, 60, DEFAULTS.interval_days);
    const maxReminders = clamp(cfg.max_reminders, 1, 20, DEFAULTS.max_reminders);

    console.log(`Reminder rule: first after ${firstAfterDays}d, interval ${intervalDays}d, max ${maxReminders}`);

    const firstCutoff = new Date();
    firstCutoff.setDate(firstCutoff.getDate() - firstAfterDays);
    const intervalCutoff = new Date();
    intervalCutoff.setDate(intervalCutoff.getDate() - intervalDays);

    const { data: pendingContracts, error: fetchError } = await supabase
      .from("contracts")
      .select(`
        id,
        title,
        sent_at,
        reminder_count,
        last_reminder_at,
        employee:employee_master_data(id, first_name, last_name, private_email)
      `)
      .eq("status", "pending_employee")
      .lt("sent_at", firstCutoff.toISOString())
      .not("sent_at", "is", null)
      .lt("reminder_count", maxReminders);

    if (fetchError) {
      console.error("Error fetching contracts:", fetchError);
      throw fetchError;
    }

    // Only remind when the last reminder is old enough (or none has been sent)
    const eligibleContracts = (pendingContracts || []).filter(contract => {
      if (!contract.last_reminder_at) return true;
      const lastReminder = new Date(contract.last_reminder_at);
      return lastReminder <= intervalCutoff;
    });

    if (dryRun) {
      console.log(`DRY RUN: ${eligibleContracts.length} contracts would receive a reminder`);
      return new Response(
        JSON.stringify({
          dry_run: true,
          rule: { firstAfterDays, intervalDays, maxReminders },
          count: eligibleContracts.length,
          contracts: eligibleContracts.map((c) => ({
            id: c.id,
            title: c.title,
            sent_at: c.sent_at,
            reminder_count: c.reminder_count,
            employee: `${(c.employee as any)?.first_name ?? ""} ${(c.employee as any)?.last_name ?? ""}`.trim(),
          })),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    if (eligibleContracts.length === 0) {
      console.log("No pending contracts requiring reminders");
      return new Response(
        JSON.stringify({ message: "No reminders to send", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${eligibleContracts.length} contracts eligible for reminder`);

    const baseUrl = "https://stork.copenhagensales.dk";
    let sentCount = 0;
    let accessToken: string | null = null;

    for (const contract of eligibleContracts) {
      const employee = contract.employee as any;
      if (!employee?.private_email) {
        console.log(`Skipping contract ${contract.id} - no employee email`);
        continue;
      }

      const contractUrl = `${baseUrl}/contract/${contract.id}`;
      const daysSinceSent = Math.floor(
        (Date.now() - new Date(contract.sent_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>COPENHAGEN SALES</h1>
              <p>⏰ Påmindelse - Kontrakt afventer underskrift</p>
            </div>
            <div class="content">
              <p>Kære ${employee.first_name},</p>
              
              <div class="warning">
                <strong>Du har en kontrakt der afventer din underskrift i ${daysSinceSent} dage.</strong>
              </div>
              
              <p>Kontrakten "<strong>${contract.title}</strong>" blev sendt til dig og afventer stadig din gennemgang og underskrift.</p>
              
              <p style="text-align: center;">
                <a href="${contractUrl}" class="button">Gennemgå og underskriv nu</a>
              </p>
              
              <p style="color: #6b7280; font-size: 14px;">
                Hvis du har spørgsmål til kontrakten, er du velkommen til at kontakte din leder.
              </p>
              
              <p>Med venlig hilsen,<br><strong>Copenhagen Sales</strong></p>
            </div>
            <div class="footer">
              <p>Dette er en automatisk påmindelse fra Copenhagen Sales.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        // Get access token once for all emails
        if (!accessToken) {
          accessToken = await getM365AccessToken();
        }

        await sendEmail(
          accessToken,
          employee.private_email,
          `⏰ Påmindelse: Kontrakt "${contract.title}" afventer din underskrift`,
          htmlBody
        );

        // Update reminder tracking
        const newReminderCount = (contract.reminder_count || 0) + 1;
        await supabase
          .from("contracts")
          .update({ 
            reminder_count: newReminderCount, 
            last_reminder_at: new Date().toISOString() 
          })
          .eq("id", contract.id);

        sentCount++;
        console.log(`Reminder ${newReminderCount}/3 sent to ${employee.private_email} for contract ${contract.id}`);
      } catch (emailError) {
        console.error(`Failed to send reminder to ${employee.private_email}:`, emailError);
      }
    }

    console.log(`Sent ${sentCount} reminder emails`);

    return new Response(
      JSON.stringify({ message: "Reminders processed", sent: sentCount, total: pendingContracts.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-contract-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);