import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationRequest {
  contractId: string;
  employeeName: string;
  employeeEmail: string;
  contractTitle: string;
  signedAt: string;
  ipAddress: string;
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
    const { contractId, employeeName, employeeEmail, contractTitle, signedAt, ipAddress }: ConfirmationRequest = await req.json();

    if (!employeeEmail || !contractId || !contractTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch contract content
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("content")
      .eq("id", contractId)
      .single();

    if (contractError) {
      console.error("Error fetching contract:", contractError);
      throw new Error("Could not fetch contract content");
    }

    // Format signed date
    const signedDate = new Date(signedAt);
    const formattedDate = signedDate.toLocaleDateString("da-DK", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header img { max-width: 180px; height: auto; margin-bottom: 10px; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
          .success-badge { background: #dcfce7; color: #166534; padding: 15px 25px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #bbf7d0; }
          .success-badge h2 { margin: 0 0 5px 0; font-size: 18px; }
          .details-box { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; }
          .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .details-row:last-child { border-bottom: none; }
          .details-label { color: #64748b; font-size: 14px; }
          .details-value { font-weight: 600; color: #1e293b; }
          .contract-content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 25px 0; max-height: 500px; overflow-y: auto; }
          .contract-content h1, .contract-content h2, .contract-content h3 { color: #1e293b; }
          .legal-notice { font-size: 11px; color: #94a3b8; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://copenhagensales.dk/wp-content/uploads/2023/03/Logo-white-1536x791-1.png" alt="Copenhagen Sales" />
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Bekræftelse på underskrift</p>
          </div>
          <div class="content">
            <div class="success-badge">
              <h2>✓ Kontrakt underskrevet</h2>
              <p style="margin: 0; font-size: 14px;">Din underskrift er registreret</p>
            </div>
            
            <p>Kære ${employeeName},</p>
            
            <p>Vi bekræfter hermed, at du har underskrevet følgende kontrakt:</p>
            
            <div class="details-box">
              <div class="details-row">
                <span class="details-label">Kontrakt</span>
                <span class="details-value">${contractTitle}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Underskrevet</span>
                <span class="details-value">${formattedDate}</span>
              </div>
              <div class="details-row">
                <span class="details-label">IP-adresse</span>
                <span class="details-value">${ipAddress}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Kontrakt-ID</span>
                <span class="details-value" style="font-family: monospace; font-size: 12px;">${contractId}</span>
              </div>
            </div>

            <h3 style="margin-top: 30px;">Kopi af kontrakten</h3>
            <p style="font-size: 14px; color: #64748b;">Nedenfor finder du en kopi af kontraktens indhold til dine arkiver:</p>
            
            <div class="contract-content">
              ${contract.content}
            </div>

            <p class="legal-notice">
              <strong>Juridisk dokumentation:</strong> Denne email fungerer som bekræftelse på din elektroniske underskrift. 
              Underskriften er juridisk bindende i henhold til dansk lovgivning om elektroniske signaturer. 
              Dato, tidspunkt, og IP-adresse er registreret som dokumentation for underskriften.
              Gem denne email til dine egne arkiver.
            </p>
          </div>
          <div class="footer">
            <p>Copenhagen Sales<br>
            Denne email er sendt automatisk. Svar ikke på denne email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`Sending contract signed confirmation to ${employeeEmail} for contract ${contractId}`);

    const accessToken = await getM365AccessToken();
    await sendEmail(accessToken, employeeEmail, `Bekræftelse: Du har underskrevet "${contractTitle}"`, htmlBody);

    console.log(`Contract signed confirmation sent successfully to ${employeeEmail}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-contract-signed-confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
