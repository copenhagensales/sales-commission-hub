import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  employee_id?: string;
  team_id?: string | null;
  source?: string;
  is_followup?: boolean;
  /** Resolve recipients + template without sending (used by the settings screen). */
  preview_only?: boolean;
  /** Send a test mail to these addresses only. Owners only. */
  test_recipients?: string[];
  /** Legacy callers may still pass an explicit recipient list. */
  recipients?: string[];
  employee_name?: string;
  employee_email?: string;
  team_name?: string;
}

interface Settings {
  is_enabled: boolean;
  include_team_leaders: boolean;
  include_assistant_leaders: boolean;
  include_owners: boolean;
  include_recruitment: boolean;
  recipient_job_titles: string[];
  extra_recipients: string[];
  excluded_emails: string[];
  email_subject: string;
  email_body: string;
}

const DEFAULT_SETTINGS: Settings = {
  is_enabled: true,
  include_team_leaders: true,
  include_assistant_leaders: true,
  include_owners: true,
  include_recruitment: true,
  recipient_job_titles: [],
  extra_recipients: [],
  excluded_emails: [],
  email_subject: "Medarbejder deaktiveret - Handling påkrævet",
  email_body: `Kære modtager,

En medarbejder er blevet deaktiveret i systemet.

Medarbejder: {{employee_name}}
Team: {{team_name}}
Email: {{employee_email}}
Dato: {{deactivation_date}}
Deaktiveret af: {{actor_name}}

Venligst sørg for at følgende opgaver udføres:
- Fjern adgange til systemer
- Opdater relevante lister
- Informer relevante parter

Med venlig hilsen,
CPH Sales System`,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmails(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const email = (raw || "").trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

async function getM365AccessToken(): Promise<string> {
  const tenantId = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("M365 credentials not configured");
  }

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
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
    console.error("M365 token error:", await response.text());
    throw new Error("Failed to get M365 access token");
  }

  const data = await response.json();
  return data.access_token;
}

async function sendEmail(
  accessToken: string,
  recipients: string[],
  subject: string,
  htmlBody: string,
): Promise<void> {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  if (!senderEmail) throw new Error("M365_SENDER_EMAIL not configured");

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: htmlBody },
        toRecipients: recipients.map((email) => ({ emailAddress: { address: email } })),
      },
      saveToSentItems: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("M365 send email error:", error);
    throw new Error(`Failed to send email via M365: ${error}`);
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

function buildHtml(body: string, isFollowup: boolean, isTest: boolean): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1f2937;max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:${isFollowup ? "#dc2626" : "#f59e0b"};color:#ffffff;padding:20px 24px;border-radius:10px 10px 0 0;">
      <h2 style="margin:0;font-size:18px;letter-spacing:0.02em;">${isTest ? "TEST: " : ""}${isFollowup ? "OPFØLGNING: " : ""}Medarbejder deaktiveret</h2>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
      <pre style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:14px;">${escapeHtml(body)}</pre>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Automatisk besked fra Stork · Copenhagen Sales</p>
  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body: RequestBody = await req.json();
    const {
      employee_id,
      source = "unknown",
      is_followup = false,
      preview_only = false,
      test_recipients,
    } = body;

    // ---- Auth: require a signed-in user (service-role calls bypass with the service key) ----
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let actorId: string | null = null;
    let actorName = "System";
    let actorIsOwner = false;

    if (token && token !== serviceKey) {
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      actorId = userData.user.id;
      const email = userData.user.email || "";
      const { data: actor } = await admin
        .from("employee_master_data")
        .select("first_name, last_name, job_title")
        .or(`work_email.ilike.${email},private_email.ilike.${email}`)
        .limit(1)
        .maybeSingle();
      if (actor) {
        actorName = `${actor.first_name ?? ""} ${actor.last_name ?? ""}`.trim() || email;
        actorIsOwner = actor.job_title === "Ejer";
      } else {
        actorName = email;
      }
    } else if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isTest = Array.isArray(test_recipients) && test_recipients.length > 0;
    if ((isTest || preview_only) && token !== serviceKey && !actorIsOwner) {
      return new Response(JSON.stringify({ error: "Kun ejere kan forhåndsvise eller sende test" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Settings (single source of truth, no hardcoded recipients) ----
    const { data: settingsRow } = await admin
      .from("deactivation_notification_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    const settings: Settings = { ...DEFAULT_SETTINGS, ...(settingsRow ?? {}) } as Settings;

    if (!settings.is_enabled && !preview_only && !isTest) {
      console.log("Deactivation notifications are disabled in settings — skipping");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Employee + team resolution (server-side, snapshot-safe) ----
    let employeeName = body.employee_name || "Ukendt medarbejder";
    let employeeEmail = body.employee_email || "";
    let teamId: string | null = body.team_id ?? null;

    if (employee_id) {
      const { data: employee } = await admin
        .from("employee_master_data")
        .select("first_name, last_name, work_email, private_email, team_id, last_team_id")
        .eq("id", employee_id)
        .maybeSingle();

      if (employee) {
        employeeName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || employeeName;
        employeeEmail = employee.work_email || employee.private_email || employeeEmail;
        if (!teamId) teamId = employee.team_id ?? null;
        if (!teamId) {
          const { data: membership } = await admin
            .from("team_members")
            .select("team_id")
            .eq("employee_id", employee_id)
            .limit(1)
            .maybeSingle();
          teamId = membership?.team_id ?? employee.last_team_id ?? null;
        }
      }
    }

    let teamName = body.team_name || "Ingen team";
    let teamLeaderIds: string[] = [];
    if (teamId) {
      const { data: team } = await admin
        .from("teams")
        .select("name, team_leader_id, assistant_team_leader_id")
        .eq("id", teamId)
        .maybeSingle();
      if (team) {
        teamName = team.name || teamName;
        if (settings.include_team_leaders && team.team_leader_id) teamLeaderIds.push(team.team_leader_id);
        if (settings.include_assistant_leaders && team.assistant_team_leader_id) {
          teamLeaderIds.push(team.assistant_team_leader_id);
        }
      }
    }
    teamLeaderIds = [...new Set(teamLeaderIds)];

    // ---- Recipient resolution ----
    const candidates: (string | null | undefined)[] = [...settings.extra_recipients];

    if (teamLeaderIds.length > 0) {
      const { data: leaders } = await admin
        .from("employee_master_data")
        .select("work_email, private_email")
        .in("id", teamLeaderIds);
      (leaders || []).forEach((l) => candidates.push(l.work_email || l.private_email));
    }

    const jobTitles = [
      ...settings.recipient_job_titles,
      ...(settings.include_recruitment ? ["Rekruttering"] : []),
      ...(settings.include_owners ? ["Ejer"] : []),
    ];
    const uniqueJobTitles = [...new Set(jobTitles.map((t) => t.trim()).filter(Boolean))];
    if (uniqueJobTitles.length > 0) {
      const { data: byTitle } = await admin
        .from("employee_master_data")
        .select("work_email, private_email, job_title")
        .in("job_title", uniqueJobTitles)
        .eq("is_active", true);
      (byTitle || []).forEach((e) => candidates.push(e.work_email || e.private_email));
    }

    // Team-specific extra recipients (legacy per-team config is still honoured)
    if (teamId) {
      const { data: teamConfig } = await admin
        .from("deactivation_reminder_config")
        .select("recipients, email_subject, email_body, is_active")
        .eq("team_id", teamId)
        .maybeSingle();
      if (teamConfig?.is_active !== false && teamConfig?.recipients) {
        teamConfig.recipients.split(",").forEach((r: string) => candidates.push(r));
      }
    }

    const excluded = new Set(settings.excluded_emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
    const resolvedRecipients = normalizeEmails(candidates).filter((e) => !excluded.has(e.toLowerCase()));

    // Legacy explicit list wins (used by older callers)
    const legacyRecipients = normalizeEmails(body.recipients || []);
    let recipients = isTest
      ? normalizeEmails(test_recipients!)
      : legacyRecipients.length > 0
        ? legacyRecipients
        : resolvedRecipients;

    const deactivationDate = new Date().toLocaleDateString("da-DK", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let subject = settings.email_subject;
    let emailBody = settings.email_body
      .replace(/\{\{employee_name\}\}/g, employeeName)
      .replace(/\{\{team_name\}\}/g, teamName)
      .replace(/\{\{employee_email\}\}/g, employeeEmail || "Ikke angivet")
      .replace(/\{\{deactivation_date\}\}/g, deactivationDate)
      .replace(/\{\{actor_name\}\}/g, actorName);

    if (is_followup) {
      subject = `OPFØLGNING: ${subject}`;
      emailBody = `⚠️ PÅMINDELSE - Denne handling er stadig ikke udført!\n\n${emailBody}`;
    }
    if (isTest) {
      subject = `TEST: ${subject}`;
    }

    if (preview_only) {
      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          recipients: resolvedRecipients,
          subject,
          body: emailBody,
          employee_name: employeeName,
          team_name: teamName,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (recipients.length === 0) {
      console.warn(`No recipients resolved for deactivation of ${employeeName} (source: ${source})`);
      if (employee_id && !isTest) {
        await admin.from("deactivation_reminders_sent").insert({
          employee_id,
          team_id: teamId,
          recipients: [],
          initial_sent_at: new Date().toISOString(),
          source,
          subject,
          status: "no_recipients",
          error_message: "Ingen modtagere kunne udledes fra indstillingerne",
          triggered_by: actorId,
        });
      }
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: "no_recipients" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Duplicate guard: one initial mail per employee per 5 minutes ----
    if (!is_followup && !isTest && employee_id) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: existing } = await admin
        .from("deactivation_reminders_sent")
        .select("id")
        .eq("employee_id", employee_id)
        .eq("status", "sent")
        .eq("is_test", false)
        .gte("initial_sent_at", fiveMinutesAgo)
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log(`Skipping duplicate deactivation mail for ${employeeName}`);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "duplicate" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const htmlBody = buildHtml(emailBody, is_followup, isTest);

    try {
      const accessToken = await getM365AccessToken();
      await sendEmail(accessToken, recipients, subject, htmlBody);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Ukendt fejl";
      if (employee_id && !isTest) {
        await admin.from("deactivation_reminders_sent").insert({
          employee_id,
          team_id: teamId,
          recipients,
          initial_sent_at: new Date().toISOString(),
          source,
          subject,
          status: "failed",
          error_message: message,
          triggered_by: actorId,
        });
      }
      throw sendError;
    }

    if (isTest) {
      console.log(`Test deactivation mail sent to ${recipients.length} recipients`);
    } else if (!is_followup) {
      await admin.from("deactivation_reminders_sent").insert({
        employee_id,
        team_id: teamId,
        recipients,
        initial_sent_at: new Date().toISOString(),
        source,
        subject,
        status: "sent",
        triggered_by: actorId,
      });
    } else {
      await admin
        .from("deactivation_reminders_sent")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("employee_id", employee_id!)
        .is("followup_sent_at", null);
    }

    return new Response(
      JSON.stringify({ success: true, recipientCount: recipients.length, recipients, test: isTest }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-deactivation-reminder:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
