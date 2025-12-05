import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContractEmailRequest {
  employeeName: string;
  employeeEmail: string;
  contractTitle: string;
  contractId: string;
  senderName?: string;
  appUrl?: string;
}

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeName, employeeEmail, contractTitle, contractId, senderName, appUrl }: ContractEmailRequest = await req.json();

    if (!employeeEmail || !contractId || !contractTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = appUrl || "https://jwlimmeijpfmaksvmuru.lovableproject.com";
    const contractUrl = `${baseUrl}/contract/${contractId}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .button:hover { background: #2563eb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .contract-title { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Copenhagen Sales</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Ny kontrakt til underskrift</p>
          </div>
          <div class="content">
            <p>Kære ${employeeName},</p>
            
            <p>Du har modtaget en ny kontrakt, som afventer din underskrift:</p>
            
            <div class="contract-title">
              <strong>${contractTitle}</strong>
            </div>
            
            <p>Klik på knappen nedenfor for at gennemgå og underskrive kontrakten:</p>
            
            <p style="text-align: center;">
              <a href="${contractUrl}" class="button">Gennemgå og underskriv</a>
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
              Hvis knappen ikke virker, kan du kopiere dette link til din browser:<br>
              <a href="${contractUrl}" style="color: #3b82f6;">${contractUrl}</a>
            </p>
            
            ${senderName ? `<p>Med venlig hilsen,<br><strong>${senderName}</strong></p>` : '<p>Med venlig hilsen,<br><strong>Copenhagen Sales</strong></p>'}
          </div>
          <div class="footer">
            <p>Denne email er sendt automatisk fra Copenhagen Sales.<br>
            Svar ikke på denne email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`Sending contract email to ${employeeEmail} for contract ${contractId}`);

    const accessToken = await getM365AccessToken();
    await sendEmail(accessToken, employeeEmail, `Ny kontrakt til underskrift: ${contractTitle}`, htmlBody);

    console.log(`Contract email sent successfully to ${employeeEmail}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-contract-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
