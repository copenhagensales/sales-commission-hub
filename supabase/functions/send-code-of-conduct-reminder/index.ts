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

function buildReminderEmail(firstName: string, status: "missing" | "expired"): string {
  const headline = status === "expired"
    ? "Din Code of Conduct & GDPR test er udløbet"
    : "Du mangler at gennemføre Code of Conduct & GDPR";

  const intro = status === "expired"
    ? "Din tidligere besvarelse af Code of Conduct & GDPR-testen er udløbet (gyldighed: 2 måneder). Du skal gennemføre testen igen for at fortsætte med at bruge systemet."
    : "Du har endnu ikke gennemført den obligatoriske Code of Conduct & GDPR-test. Det er vigtigt, at du består testen hurtigst muligt.";

  return `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">

<div style="background: linear-gradient(135deg, #dc2626, #f97316); padding: 24px; border-radius: 12px; color: white; margin-bottom: 24px;">
  <h1 style="margin: 0 0 8px 0; font-size: 22px;">🛡️ ${headline}</h1>
  <p style="margin: 0; opacity: 0.95; font-size: 14px;">Påmindelse fra Copenhagen Sales</p>
</div>

<p style="font-size: 14px; line-height: 1.6;">
  Hej ${firstName},<br><br>
  ${intro}
</p>

<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 15px;">⚠️ Vigtigt</h3>
  <p style="margin: 0; font-size: 13px; line-height: 1.6;">
    Code of Conduct & GDPR-testen sikrer, at du er opdateret på regler om databeskyttelse, kundebehandling og etisk salgsadfærd. Den er obligatorisk for alle salgskonsulenter.
  </p>
</div>

<div style="text-align: center; margin: 24px 0;">
  <a href="https://provision.copenhagensales.dk/code-of-conduct"
     style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
    Gå til testen
  </a>
</div>

<p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
  Du kan også logge ind på <a href="https://provision.copenhagensales.dk" style="color: #dc2626;">provision.copenhagensales.dk</a> og finde testen i menuen.
</p>

<div style="border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 16px;">
  <p style="font-size: 11px; color: #9ca3af; margin: 0;">
    Denne mail er sendt automatisk fra Copenhagen Sales' compliance-system.<br>
    Har du spørgsmål, kontakt din teamleder eller HR.
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

    // Permission check: must have access to COC admin
    const { data: hasAccess } = await supabase.rpc("has_position_permission", {
      _user_id: user.id,
      _permission_key: "menu_coc_admin",
    });

    if (!hasAccess) {
      // Fallback: allow owners
      const { data: isOwner } = await supabase.rpc("is_owner", { _user_id: user.id });
      if (!isOwner) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse optional body for variant ('salgskonsulent' default, or 'fieldmarketing')
    let variant: "salgskonsulent" | "fieldmarketing" = "salgskonsulent";
    try {
      const body = await req.json().catch(() => null);
      if (body?.variant === "fieldmarketing" || body?.variant === "salgskonsulent") {
        variant = body.variant;
      }
    } catch (_) {
      // no body — use default
    }

    const targetJobTitle = variant === "fieldmarketing" ? "Fieldmarketing" : "Salgskonsulent";

    // Get all active employees for the chosen variant
    const { data: employees, error: empError } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name, work_email, private_email")
      .eq("is_active", true)
      .eq("job_title", targetJobTitle);

    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      return new Response(JSON.stringify({ message: "No employees", sent_count: 0, variant }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const employeeIds = employees.map((e: any) => e.id);

    // Get completions for this variant
    const { data: completions } = await supabase
      .from("code_of_conduct_completions")
      .select("employee_id, passed_at")
      .in("employee_id", employeeIds)
      .eq("quiz_variant", variant);

    const completionMap = new Map(
      (completions || []).map((c: any) => [c.employee_id, c.passed_at])
    );

    // Determine recipients: missing OR expired (>= 60 days)
    const now = Date.now();
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

    const recipients: { id: string; first_name: string; email: string; status: "missing" | "expired" }[] = [];

    for (const emp of employees as any[]) {
      const email = emp.work_email?.trim() || emp.private_email?.trim();
      if (!email) continue;

      const passedAt = completionMap.get(emp.id);
      if (!passedAt) {
        recipients.push({ id: emp.id, first_name: emp.first_name, email, status: "missing" });
      } else {
        const ageMs = now - new Date(passedAt as string).getTime();
        if (ageMs >= SIXTY_DAYS_MS) {
          recipients.push({ id: emp.id, first_name: emp.first_name, email, status: "expired" });
        }
      }
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent_count: 0, message: "Alle har bestået og er gyldige" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via M365 Graph (one email per recipient for personalization)
    const accessToken = await getM365AccessToken();
    const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
    if (!senderEmail) throw new Error("Missing M365_SENDER_EMAIL");

    let sentCount = 0;
    const failures: string[] = [];

    for (const r of recipients) {
      const htmlBody = buildReminderEmail(r.first_name || "kollega", r.status);
      const subject = r.status === "expired"
        ? "🛡️ Din Code of Conduct & GDPR test er udløbet"
        : "🛡️ Påmindelse: Gennemfør Code of Conduct & GDPR";

      try {
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
                toRecipients: [{ emailAddress: { address: r.email } }],
              },
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`M365 send error for ${r.email}:`, errorText);
          failures.push(r.email);
        } else {
          sentCount += 1;
        }
      } catch (err) {
        console.error(`Send error for ${r.email}:`, err);
        failures.push(r.email);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: sentCount,
        total_recipients: recipients.length,
        failures,
        missing_count: recipients.filter((r) => r.status === "missing").length,
        expired_count: recipients.filter((r) => r.status === "expired").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
