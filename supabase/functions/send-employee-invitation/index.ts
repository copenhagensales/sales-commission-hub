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
  appUrl?: string;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { employeeId, email, firstName, lastName, appUrl }: InvitationRequest = await req.json();

    if (!employeeId || !email || !firstName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique token
    const token = generateToken();

    // Create invitation record
    const { error: insertError } = await supabase
      .from("employee_invitations")
      .insert({
        employee_id: employeeId,
        email,
        token,
        status: "pending",
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build invitation URL - use provided appUrl or fall back to origin header
    const baseUrl = appUrl || req.headers.get("origin") || "https://40ce8d9b-c988-4d3b-a8ed-63eb5bed2204.lovableproject.com";
    const invitationUrl = `${baseUrl}/onboarding?token=${token}`;
    
    console.log("Invitation URL debug:", { appUrl, origin: req.headers.get("origin"), baseUrl, invitationUrl });

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
          .header img { max-width: 180px; height: auto; margin-bottom: 10px; }
          .header h1 { margin: 10px 0 0 0; font-size: 24px; font-weight: normal; }
          .content { padding: 30px; background: #ffffff; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://copenhagensales.dk/wp-content/uploads/2023/03/Logo-white-1536x791-1.png" alt="Copenhagen Sales" />
            <h1>Velkommen!</h1>
          </div>
          <div class="content">
            <p>Hej ${firstName}${lastName ? " " + lastName : ""},</p>
            <p>Du er blevet tilføjet som medarbejder hos Copenhagen Sales. Vi beder dig udfylde dine personlige oplysninger via linket nedenfor.</p>
            <p>Klik på knappen for at udfylde dine stamdata:</p>
            <a href="${invitationUrl}" class="button">Udfyld mine oplysninger</a>
            <p>Linket er gyldigt i 7 dage.</p>
            <p>Hvis du har spørgsmål, er du velkommen til at kontakte os.</p>
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
      "Velkommen til Copenhagen Sales - Udfyld dine oplysninger",
      emailHtml
    );

    console.log(`Invitation sent to ${email} for employee ${employeeId}`);

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
