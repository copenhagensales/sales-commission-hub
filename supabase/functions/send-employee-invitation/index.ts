import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
}

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

async function sendEmail(accessToken: string, to: string | string[], subject: string, htmlBody: string): Promise<void> {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  
  if (!senderEmail) {
    throw new Error("Missing M365_SENDER_EMAIL");
  }

  // Support multiple recipients
  const recipients = Array.isArray(to) ? to : [to];
  const toRecipients = recipients.map(email => ({
    emailAddress: { address: email },
  }));

  const emailPayload = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: htmlBody,
      },
      toRecipients,
    },
    saveToSentItems: true,
  };

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Send email error:", error);
    throw new Error(`Failed to send email: ${response.status}`);
  }
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { employeeId, email, firstName, lastName }: InvitationRequest = await req.json();

    if (!employeeId || !email || !firstName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique token
    const token = generateToken();

    // Invalidate any existing pending invitations for this employee
    await supabase
      .from("employee_invitations")
      .update({ status: "invalidated" })
      .eq("employee_id", employeeId)
      .eq("status", "pending");

    // Create invitation record with 48 hour expiry (security fix 2.2)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    
    const { error: insertError } = await supabase
      .from("employee_invitations")
      .insert({
        employee_id: employeeId,
        email,
        token,
        status: "pending",
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update employee invitation status
    await supabase
      .from("employee_master_data")
      .update({ invitation_status: "pending" })
      .eq("id", employeeId);

    // Build invitation URL - hardcoded to Stork production domain to prevent
    // a misconfigured PUBLIC_APP_URL from sending users to Lovable login.
    const appUrl = "https://stork.copenhagensales.dk";
    const invitationUrl = `${appUrl}/onboarding?token=${token}`;
    
    console.log("Invitation URL created for employee:", employeeId);

    // Get M365 access token and send email
    const accessToken = await getM365AccessToken();

    const logoUrl = "https://stork.copenhagensales.dk/__l5e/assets-v1/19da5a49-decf-478f-bd35-bc6b761c0488/cphsales-logo.png";

    const emailHtml = `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Velkommen til Copenhagen Sales</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#e6f0f1;font-family:'Figtree',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#2e3136;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Velkommen til Copenhagen Sales — opret din profil på 2 minutter.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e6f0f1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(46,49,54,0.08);">
          <!-- Logo band -->
          <tr>
            <td align="center" style="background-color:#e6f0f1;padding:40px 40px 32px 40px;">
              <img src="${logoUrl}" alt="Copenhagen Sales" width="140" style="display:block;width:140px;height:auto;border:0;outline:none;text-decoration:none;">
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:48px 48px 8px 48px;">
              <p style="margin:0 0 8px 0;font-family:'Figtree',Arial,sans-serif;font-size:14px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#3BE086;">Velkommen ombord</p>
              <h1 style="margin:0;font-family:'Figtree',Arial,sans-serif;font-size:32px;line-height:1.15;font-weight:800;color:#2e3136;letter-spacing:-0.01em;">Hej ${firstName}${lastName ? " " + lastName : ""},</h1>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:20px 48px 8px 48px;">
              <p style="margin:0;font-family:'Figtree',Arial,sans-serif;font-size:16px;line-height:1.6;font-weight:400;color:#2e3136;">
                Du er blevet tilføjet som medarbejder hos Copenhagen Sales. Klik nedenfor for at oprette din profil og få adgang til systemet.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:32px 48px 8px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:#3BE086;">
                    <a href="${invitationUrl}" style="display:inline-block;padding:16px 32px;font-family:'Figtree',Arial,sans-serif;font-size:16px;font-weight:700;color:#2e3136;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Start registrering →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td align="center" style="padding:12px 48px 32px 48px;">
              <p style="margin:0;font-family:'Figtree',Arial,sans-serif;font-size:13px;line-height:1.5;color:#6b6f76;">
                Virker knappen ikke? Kopiér linket:<br>
                <a href="${invitationUrl}" style="color:#2e3136;word-break:break-all;text-decoration:underline;">${invitationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Steps card -->
          <tr>
            <td style="padding:0 48px 16px 48px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e6f0f1;border-radius:12px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 16px 0;font-family:'Figtree',Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2e3136;">
                      Sådan kommer du i gang
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Figtree',Arial,sans-serif;font-size:15px;line-height:1.55;color:#2e3136;">
                      <tr><td style="padding:6px 0;"><span style="display:inline-block;width:22px;font-weight:800;color:#3BE086;">01</span> Klik på knappen ovenfor</td></tr>
                      <tr><td style="padding:6px 0;"><span style="display:inline-block;width:22px;font-weight:800;color:#3BE086;">02</span> Udfyld personlige oplysninger (CPR, adresse, bank)</td></tr>
                      <tr><td style="padding:6px 0;"><span style="display:inline-block;width:22px;font-weight:800;color:#3BE086;">03</span> Opret din adgangskode</td></tr>
                      <tr><td style="padding:6px 0;"><span style="display:inline-block;width:22px;font-weight:800;color:#3BE086;">04</span> Log ind og kom i gang</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notice -->
          <tr>
            <td style="padding:16px 48px 8px 48px;">
              <p style="margin:0;font-family:'Figtree',Arial,sans-serif;font-size:14px;line-height:1.55;color:#2e3136;">
                <strong style="font-weight:700;">Vigtigt:</strong> Linket er gyldigt i 48 timer.
              </p>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:20px 48px 48px 48px;">
              <p style="margin:0 0 6px 0;font-family:'Figtree',Arial,sans-serif;font-size:14px;line-height:1.6;color:#6b6f76;">
                Har du spørgsmål? Skriv til os — vi er glade for at hjælpe.
              </p>
              <p style="margin:16px 0 0 0;font-family:'Figtree',Arial,sans-serif;font-size:14px;line-height:1.6;color:#2e3136;">
                Med venlig hilsen,<br>
                <strong style="font-weight:700;">Copenhagen Sales</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#2e3136;padding:24px 48px;text-align:center;">
              <p style="margin:0;font-family:'Figtree',Arial,sans-serif;font-size:12px;line-height:1.5;color:#e6f0f1;opacity:0.7;">
                Denne email er sendt automatisk. Svar venligst ikke på denne email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send to employee
    await sendEmail(
      accessToken,
      email,
      "Velkommen til Copenhagen Sales - Opret din profil",
      emailHtml
    );

    console.log(`Invitation sent for employee ${employeeId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Invitation sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
