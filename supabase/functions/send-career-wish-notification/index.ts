import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CareerWishNotificationRequest {
  employeeName: string;
  employeeDepartment: string | null;
  wantsTeamChange: "yes" | "no";
  desiredTeam: string | null;
  teamChangeMotivation: string | null;
  leadershipInterest: "yes" | "maybe" | "no";
  leadershipRoleType: string | null;
  leadershipMotivation: string | null;
  otherComments: string | null;
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
    throw new Error(`Failed to send email to ${to}`);
  }
}

// Get recipients (owners and rekruttering)
async function getRecipients(): Promise<string[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get user IDs with ejer or rekruttering roles
  const { data: roles, error: rolesError } = await supabase
    .from("system_roles")
    .select("user_id, role")
    .in("role", ["ejer", "rekruttering"]);

  if (rolesError) {
    console.error("Error fetching roles:", rolesError);
    return [];
  }

  if (!roles || roles.length === 0) {
    console.log("No owners or rekruttering found");
    return [];
  }

  // Get emails from employee_master_data
  const userIds = roles.map(r => r.user_id);
  
  // Get auth users to get their emails
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error("Error fetching users:", usersError);
    return [];
  }

  const recipientEmails = users
    .filter(u => userIds.includes(u.id))
    .map(u => u.email)
    .filter((email): email is string => !!email);

  console.log("Found recipients:", recipientEmails);
  return recipientEmails;
}

function formatLeadershipInterest(interest: string): string {
  switch (interest) {
    case "yes": return "Ja, interesseret i ledelse";
    case "maybe": return "Måske på sigt";
    case "no": return "Nej, ikke lige nu";
    default: return interest;
  }
}

function formatLeadershipRole(role: string | null): string {
  if (!role) return "";
  switch (role) {
    case "junior_teamleder": return "Junior teamleder";
    case "teamleder": return "Teamleder";
    case "coach": return "Coach/træner";
    case "other": return "Andet";
    default: return role;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: CareerWishNotificationRequest = await req.json();
    console.log("Received career wish notification request:", data);

    const recipients = await getRecipients();
    
    if (recipients.length === 0) {
      console.log("No recipients found, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "No recipients found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px; }
          .header p { margin: 10px 0 0 0; opacity: 0.9; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .section { background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .section-title { font-weight: 600; color: #374151; margin-bottom: 10px; }
          .field { margin: 8px 0; }
          .field-label { color: #6b7280; font-size: 13px; }
          .field-value { color: #111827; font-weight: 500; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
          .highlight { background: #dbeafe; padding: 3px 8px; border-radius: 4px; }
          .motivation { background: #fff; border-left: 3px solid #3b82f6; padding: 10px 15px; margin: 10px 0; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>COPENHAGEN SALES</h1>
            <p>Nyt karriereønske modtaget</p>
          </div>
          <div class="content">
            <p>En medarbejder har indsendt et karriereønske:</p>
            
            <div class="section">
              <div class="section-title">Medarbejderinfo</div>
              <div class="field">
                <span class="field-label">Navn:</span>
                <span class="field-value">${data.employeeName}</span>
              </div>
              <div class="field">
                <span class="field-label">Nuværende team:</span>
                <span class="field-value">${data.employeeDepartment || "Ikke angivet"}</span>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Teamskifte</div>
              <div class="field">
                <span class="field-label">Ønsker teamskifte:</span>
                <span class="field-value ${data.wantsTeamChange === 'yes' ? 'highlight' : ''}">${data.wantsTeamChange === 'yes' ? 'Ja' : 'Nej'}</span>
              </div>
              ${data.wantsTeamChange === 'yes' ? `
                <div class="field">
                  <span class="field-label">Ønsket team:</span>
                  <span class="field-value">${data.desiredTeam === 'open_for_suggestions' ? 'Åben for forslag fra ledelsen' : data.desiredTeam}</span>
                </div>
                ${data.teamChangeMotivation ? `<div class="motivation">${data.teamChangeMotivation}</div>` : ''}
              ` : ''}
            </div>
            
            <div class="section">
              <div class="section-title">Ledelsesinteresse</div>
              <div class="field">
                <span class="field-label">Interesseret i ledelse:</span>
                <span class="field-value ${data.leadershipInterest !== 'no' ? 'highlight' : ''}">${formatLeadershipInterest(data.leadershipInterest)}</span>
              </div>
              ${data.leadershipInterest !== 'no' && data.leadershipRoleType ? `
                <div class="field">
                  <span class="field-label">Ønsket rolle:</span>
                  <span class="field-value">${formatLeadershipRole(data.leadershipRoleType)}</span>
                </div>
                ${data.leadershipMotivation ? `<div class="motivation">${data.leadershipMotivation}</div>` : ''}
              ` : ''}
            </div>
            
            ${data.otherComments ? `
              <div class="section">
                <div class="section-title">Øvrige kommentarer</div>
                <div class="motivation">${data.otherComments}</div>
              </div>
            ` : ''}
            
            <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
              Denne anmodning kan ses i systemet under karriereønsker.
            </p>
          </div>
          <div class="footer">
            <p>Denne email er sendt automatisk fra Copenhagen Sales.<br>
            Svar ikke på denne email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const accessToken = await getM365AccessToken();
    
    // Send to all recipients
    for (const recipient of recipients) {
      try {
        await sendEmail(
          accessToken,
          recipient,
          `Nyt karriereønske fra ${data.employeeName}`,
          htmlBody
        );
        console.log(`Email sent to ${recipient}`);
      } catch (emailError) {
        console.error(`Failed to send to ${recipient}:`, emailError);
      }
    }

    console.log(`Career wish notification sent to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({ success: true, recipientCount: recipients.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-career-wish-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
