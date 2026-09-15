// Aktiverer en ny medarbejder: opretter/genbruger auth-brugeren på arbejdsmailen
// (så Microsoft-login virker med det samme) og sender en velkomstmail til privat mail.
// Erstatter det gamle link-baserede invitationsflow, som ikke virker med SSO.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireManager, sharedCorsHeaders } from "../_shared/auth.ts";
import { sendM365Mail } from "../_shared/m365-mail.ts";

const jsonHeaders = { ...sharedCorsHeaders, "Content-Type": "application/json" };

const APP_URL = "https://stork.copenhagensales.dk";
const DEFAULT_PASSWORD_HINT = "Copenhagensales2";

interface ActivateRequest {
  employeeId?: string;
  workEmail?: string;
  privateEmail?: string | null;
  firstName?: string;
  lastName?: string | null;
  startDate?: string | null;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

function formatDanishDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function welcomeHtml(params: {
  firstName: string;
  workEmail: string;
  startDate: string | null;
}): string {
  const name = escapeHtml(params.firstName);
  const workEmail = escapeHtml(params.workEmail);
  const startLine = params.startDate
    ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Første dag</td><td style="padding:4px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(params.startDate)}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="da">
  <body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f7;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background-color:#0f172a;padding:24px 28px;">
                <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">Copenhagen Sales</div>
                <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Velkommen til Stork</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Velkommen, ${name}!</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                  Din adgang til Stork er klar. Stork er vores system til vagtplan, salg, provision og alt det praktiske.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;padding:14px 16px;margin:0 0 20px;">
                  <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Du logger ind med</td><td style="padding:4px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${workEmail}</td></tr>
                  <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Standardkode</td><td style="padding:4px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${DEFAULT_PASSWORD_HINT}</td></tr>
                  ${startLine}
                </table>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
                  Du logger ind med din Copenhagensales-mail og dit Microsoft-login. Standardkoden er
                  <strong>${DEFAULT_PASSWORD_HINT}</strong> — medmindre du allerede selv har ændret den.
                </p>
                <a href="${APP_URL}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:8px;">Gå til Stork</a>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                  Virker loginet ikke, så sig til på din første dag — så får vi det på plads med det samme.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f8fafc;padding:16px 28px;color:#94a3b8;font-size:12px;">
                Copenhagen Sales ApS · ${APP_URL.replace("https://", "")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: sharedCorsHeaders });
  }

  // SECURITY: kun ledere og opefter må oprette brugeradgang
  const auth = await requireManager(req);
  if (auth instanceof Response) return auth;
  const svc = auth.svc;

  try {
    const body: ActivateRequest = await req.json();
    const employeeId = body.employeeId?.trim();
    const workEmail = body.workEmail?.trim().toLowerCase();
    const privateEmail = body.privateEmail?.trim().toLowerCase() || null;
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim() || "";
    const startDate = body.startDate?.trim() || null;

    if (!employeeId || !workEmail || !firstName) {
      return new Response(
        JSON.stringify({ error: "employeeId, workEmail og firstName er påkrævet" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    if (!isEmail(workEmail) || workEmail.length > 255) {
      return new Response(JSON.stringify({ error: "Ugyldig arbejdsmail" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: employee, error: empError } = await svc
      .from("employee_master_data")
      .select("id, first_name, last_name, work_email, private_email, auth_user_id")
      .eq("id", employeeId)
      .maybeSingle();

    if (empError) throw empError;
    if (!employee) {
      return new Response(JSON.stringify({ error: "Medarbejderen findes ikke" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    // 1. Arbejdsmailen må ikke være i brug af en anden medarbejder
    const { data: emailOwner } = await svc
      .from("employee_master_data")
      .select("id")
      .ilike("work_email", workEmail)
      .neq("id", employeeId)
      .maybeSingle();
    if (emailOwner) {
      return new Response(
        JSON.stringify({ error: "Arbejdsmailen bruges allerede af en anden medarbejder" }),
        { status: 409, headers: jsonHeaders },
      );
    }

    // 2. Auth-bruger: genbrug hvis mailen allerede findes, ellers opret
    const { data: existingAuthRow } = await svc
      .schema("auth")
      .from("users")
      .select("id")
      .ilike("email", workEmail)
      .maybeSingle();

    let authUserId = existingAuthRow?.id as string | undefined;
    let accountCreated = false;

    if (!authUserId) {
      const { data: created, error: createError } = await svc.auth.admin.createUser({
        email: workEmail,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          name: `${firstName} ${lastName}`.trim(),
          email: workEmail,
          email_verified: true,
        },
      });
      if (createError) {
        console.error("createUser-fejl:", createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
      authUserId = created.user.id;
      accountCreated = true;
    }

    // 3. Kobl medarbejder til auth-bruger og sæt arbejdsmail (uden at overskrive en anden mail)
    const employeeUpdate: Record<string, unknown> = {
      auth_user_id: authUserId,
      invitation_status: "active",
    };
    const currentWorkEmail = (employee.work_email as string | null)?.toLowerCase() ?? null;
    if (!currentWorkEmail || currentWorkEmail === workEmail) {
      employeeUpdate.work_email = workEmail;
    }
    if (startDate) employeeUpdate.employment_start_date = startDate;

    const { error: updateError } = await svc
      .from("employee_master_data")
      .update(employeeUpdate)
      .eq("id", employeeId);
    if (updateError) throw updateError;

    // 4. Standardrolle medarbejder, hvis brugeren ikke allerede har en rolle
    const { data: existingRole } = await svc
      .from("system_roles")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (!existingRole) {
      const { error: roleError } = await svc
        .from("system_roles")
        .insert({ user_id: authUserId, role: "medarbejder" });
      if (roleError) console.error("Rolle-fejl:", roleError);
    }

    // 5. Velkomstmail til privat mail (må ikke vælte aktiveringen)
    const recipient = privateEmail || (employee.private_email as string | null);
    let mailSent = false;
    let mailError: string | null = null;
    if (recipient && isEmail(recipient)) {
      try {
        await sendM365Mail({
          to: [recipient],
          subject: "Velkommen til Copenhagen Sales — din adgang til Stork",
          html: welcomeHtml({
            firstName,
            workEmail,
            startDate: formatDanishDate(startDate),
          }),
        });
        mailSent = true;
      } catch (err) {
        mailError = err instanceof Error ? err.message : "Ukendt mailfejl";
        console.error("Velkomstmail-fejl:", mailError);
      }
    } else {
      mailError = "Ingen privat mail på medarbejderen";
    }

    return new Response(
      JSON.stringify({
        success: true,
        authUserId,
        accountCreated,
        mailSent,
        mailError,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    console.error("activate-employee-account fejl:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Ukendt fejl" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
