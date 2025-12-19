import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetRequest {
  employeeId: string;
  email: string;
  firstName: string;
  lastName?: string;
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

async function sendEmail(accessToken: string, to: string, subject: string, htmlBody: string): Promise<void> {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  
  if (!senderEmail) {
    throw new Error("Missing M365_SENDER_EMAIL");
  }

  const emailPayload = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: htmlBody,
      },
      toRecipients: [
        {
          emailAddress: { address: to },
        },
      ],
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

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { employeeId, email, firstName, lastName }: ResetRequest = await req.json();

    if (!employeeId || !email || !firstName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate token and hash it
    const token = generateToken();
    const tokenHash = await hashToken(token);

    console.log(`Creating password reset for employee ${employeeId}, email: ${email}`);

    // Invalidate any existing unused tokens for this employee
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("employee_id", employeeId)
      .is("used_at", null);

    // Create new token record with hashed token
    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({
        employee_id: employeeId,
        email,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create reset token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build reset URL - use production URL
    const productionUrl = "https://40ce8d9b-c988-4d3b-a8ed-63eb5bed2204.lovableproject.com";
    const resetUrl = `${productionUrl}/reset-password?token=${token}`;
    
    console.log("Reset URL created for:", email);

    // Get M365 access token and send email
    const accessToken = await getM365AccessToken();

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a365d; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px; }
          .header p { margin: 10px 0 0 0; font-size: 18px; font-weight: normal; opacity: 0.9; }
          .content { padding: 30px; background: #ffffff; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
          .warning { color: #b45309; background: #fef3c7; padding: 12px; border-radius: 4px; margin: 16px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>COPENHAGEN SALES</h1>
            <p>Nulstil din adgangskode</p>
          </div>
          <div class="content">
            <p>Hej ${firstName}${lastName ? " " + lastName : ""},</p>
            <p>Vi har modtaget en anmodning om at nulstille din adgangskode til Copenhagen Sales.</p>
            <p>Klik på knappen nedenfor for at oprette en ny adgangskode:</p>
            <a href="${resetUrl}" class="button">Opret ny adgangskode</a>
            <div class="warning">
              <strong>Vigtigt:</strong> Dette link udløber om 24 timer.
            </div>
            <p>Hvis du ikke har anmodet om at nulstille din adgangskode, kan du ignorere denne email.</p>
            <p>Med venlig hilsen,<br>Copenhagen Sales</p>
          </div>
          <div class="footer">
            <p>Denne email er sendt automatisk. Svar venligst ikke på denne email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(
      accessToken,
      email,
      "Nulstil din adgangskode - Copenhagen Sales",
      emailHtml
    );

    console.log(`Password reset email sent to ${email} for employee ${employeeId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent" }),
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
