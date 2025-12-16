import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClosingReminderRequest {
  employeeName?: string;
  email?: string;
  phone?: string;
  tasks?: string[];
  auto?: boolean; // Flag for automatic/scheduled execution
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

async function sendEmail(accessToken: string, to: string, subject: string, htmlBody: string): Promise<void> {
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
      toRecipients: [{ emailAddress: { address: to } }],
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
    const body: ClosingReminderRequest = await req.json().catch(() => ({}));
    
    let employeeName = body.employeeName;
    let email = body.email;
    let phone = body.phone;
    let tasks = body.tasks || [];

    // If auto mode or no employee provided, fetch from database based on current weekday
    if (body.auto || (!employeeName && !email)) {
      console.log("Auto mode: fetching today's closing shift from database");
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get current weekday (1 = Monday, 5 = Friday in our system)
      // JavaScript getDay() returns 0 = Sunday, 1 = Monday, etc.
      const now = new Date();
      const jsDay = now.getDay(); // 0-6, Sunday-Saturday
      const weekday = jsDay === 0 ? 7 : jsDay; // Convert to 1-7, Monday-Sunday

      console.log(`Current weekday: ${weekday} (JS day: ${jsDay})`);

      // Only send on weekdays (1-5)
      if (weekday > 5) {
        console.log("Weekend - no closing shift reminder needed");
        return new Response(
          JSON.stringify({ success: true, message: "No reminder on weekends" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Fetch today's closing shift
      const { data: shift, error } = await supabase
        .from("closing_shifts")
        .select("*")
        .eq("weekday", weekday)
        .single();

      if (error || !shift) {
        console.error("Error fetching shift:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Could not find today's shift" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      employeeName = shift.employee_name;
      email = shift.email;
      phone = shift.phone;

      // Get tasks from weekday 1 (stored there)
      if (tasks.length === 0) {
        const { data: tasksShift } = await supabase
          .from("closing_shifts")
          .select("tasks")
          .eq("weekday", 1)
          .single();

        if (tasksShift?.tasks) {
          tasks = tasksShift.tasks.split("\n").filter((t: string) => t.trim());
        }
      }

      console.log(`Sending to: ${employeeName}, email: ${email}, tasks: ${tasks.length}`);
    }

    if (!employeeName) {
      console.log("No employee name configured for today");
      return new Response(
        JSON.stringify({ success: false, error: "No employee configured for today" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!email && !phone) {
      console.log("No email or phone configured");
      return new Response(
        JSON.stringify({ success: false, error: "No contact info configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const taskList = tasks.map((task) => `• ${task}`).join("\n");
    const taskListHtml = tasks.map((task) => `<li>${task}</li>`).join("");

    const results: { email?: boolean; sms?: boolean } = {};

    // Send email via M365 if email provided
    if (email) {
      try {
        console.log(`Sending email to ${email} via M365`);
        const accessToken = await getM365AccessToken();
        
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="padding: 20px 0; border-bottom: 1px solid #eee;">
              <h2 style="margin: 0; color: #333;">COPENHAGEN SALES</h2>
            </div>
            <div style="padding: 20px 0;">
              <h1 style="color: #333;">Hej ${employeeName}!</h1>
              <p>Dette er en påmindelse om, at du har lukkevagt i dag.</p>
              <h2 style="color: #555;">Husk at:</h2>
              <ul style="line-height: 1.8;">
                ${taskListHtml}
              </ul>
              <p style="margin-top: 20px; color: #666;">God aften!</p>
            </div>
            <div style="padding: 20px 0; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              <p>Med venlig hilsen,<br>Copenhagen Sales</p>
            </div>
          </div>
        `;
        
        await sendEmail(accessToken, email, "Påmindelse: Du har lukkevagt i dag", htmlBody);
        console.log("Email sent successfully via M365");
        results.email = true;
      } catch (error) {
        console.error("M365 email error:", error);
      }
    }

    // Send SMS if phone provided
    if (phone) {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
        const formattedPhone = phone.startsWith("+") ? phone : `+45${phone.replace(/\s/g, "")}`;
        
        const smsMessage = `Hej ${employeeName}! Du har lukkevagt i dag. Husk:\n${taskList}\n\nGod aften! - Copenhagen Sales`;

        console.log(`Sending SMS to ${formattedPhone}`);
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

        const smsResponse = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: formattedPhone,
            From: twilioPhoneNumber,
            Body: smsMessage,
          }),
        });

        if (smsResponse.ok) {
          console.log("SMS sent successfully");
          results.sms = true;
        } else {
          const errorText = await smsResponse.text();
          console.error("SMS error:", errorText);
        }
      }
    }

    console.log("Reminder results:", results);
    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-closing-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
