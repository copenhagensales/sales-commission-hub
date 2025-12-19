import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeekendCleanupRequest {
  recipients?: string[];
  tasks?: string[];
  auto?: boolean;
}

async function getM365AccessToken(): Promise<string> {
  const tenantId = Deno.env.get('M365_TENANT_ID');
  const clientId = Deno.env.get('M365_CLIENT_ID');
  const clientSecret = Deno.env.get('M365_CLIENT_SECRET');

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('M365 credentials not configured');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('M365 token error:', errorText);
    throw new Error('Failed to get M365 access token');
  }

  const data = await response.json();
  return data.access_token;
}

async function sendEmail(accessToken: string, recipients: string[], subject: string, htmlBody: string): Promise<void> {
  const senderEmail = Deno.env.get('M365_SENDER_EMAIL');
  
  if (!senderEmail) {
    throw new Error('M365_SENDER_EMAIL not configured');
  }

  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
  
  const emailPayload = {
    message: {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: recipients.map(email => ({ emailAddress: { address: email } })),
    },
    saveToSentItems: true,
  };

  const response = await fetch(sendMailUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('M365 email error:', errorText);
    throw new Error('Failed to send email via M365');
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: WeekendCleanupRequest = await req.json().catch(() => ({}));
    
    let recipients = body.recipients || [];
    let tasks = body.tasks || [];

    // If auto mode, fetch from database
    if (body.auto || recipients.length === 0) {
      console.log("Auto mode: fetching weekend cleanup config from database");
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Check if it's Friday
      const now = new Date();
      const jsDay = now.getDay();
      
      if (body.auto && jsDay !== 5) {
        console.log("Not Friday - skipping weekend cleanup email");
        return new Response(
          JSON.stringify({ success: true, message: "Not Friday - no weekend cleanup reminder" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Fetch config
      const { data: config, error } = await supabase
        .from("weekend_cleanup_config")
        .select("*")
        .single();

      if (error || !config) {
        console.error("Error fetching weekend cleanup config:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Could not find weekend cleanup config" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (config.recipients) {
        recipients = config.recipients.split(",").map((e: string) => e.trim()).filter((e: string) => e);
      }
      
      if (config.tasks && tasks.length === 0) {
        tasks = config.tasks.split("\n").filter((t: string) => t.trim());
      }

      // Optionally fetch all managers' emails
      const { data: managers } = await supabase
        .from("employee_master_data")
        .select("private_email, work_email")
        .in("job_title", ["Ejer", "Teamleder", "Assisterende Teamleder", "Fieldmarketing leder"])
        .eq("is_active", true);

      if (managers) {
        const managerEmails = managers
          .map(m => m.work_email || m.private_email)
          .filter((e): e is string => !!e);
        
        // Merge with configured recipients (avoid duplicates)
        const allRecipients = new Set([...recipients, ...managerEmails]);
        recipients = Array.from(allRecipients);
      }

      console.log(`Sending weekend cleanup to ${recipients.length} recipients`);
    }

    if (recipients.length === 0) {
      console.log("No recipients configured");
      return new Response(
        JSON.stringify({ success: false, error: "No recipients configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const taskListHtml = tasks.map((task) => `<li>${task}</li>`).join("");

    console.log(`Sending weekend cleanup email to ${recipients.length} recipients via M365`);
    const accessToken = await getM365AccessToken();
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 20px 0; border-bottom: 1px solid #eee;">
          <h2 style="margin: 0; color: #333;">COPENHAGEN SALES</h2>
        </div>
        <div style="padding: 20px 0;">
          <h1 style="color: #d97706;">🧹 Oprydning før weekenden</h1>
          <p>Hej alle!</p>
          <p>Det er fredag, og her er en påmindelse om oprydning før weekenden:</p>
          <h2 style="color: #555;">Tjekliste:</h2>
          <ul style="line-height: 1.8;">
            ${taskListHtml}
          </ul>
          <p style="margin-top: 20px; color: #666;">God weekend!</p>
        </div>
        <div style="padding: 20px 0; border-top: 1px solid #eee; font-size: 12px; color: #666;">
          <p>Med venlig hilsen,<br>Copenhagen Sales</p>
        </div>
      </div>
    `;
    
    await sendEmail(accessToken, recipients, "🧹 Fredag: Oprydning før weekenden", htmlBody);
    console.log("Weekend cleanup email sent successfully");

    return new Response(JSON.stringify({ success: true, recipientCount: recipients.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-weekend-cleanup:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
