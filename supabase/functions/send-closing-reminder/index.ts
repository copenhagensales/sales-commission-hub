import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClosingReminderRequest {
  employeeName: string;
  email?: string;
  phone?: string;
  tasks: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeName, email, phone, tasks }: ClosingReminderRequest = await req.json();

    if (!employeeName) {
      throw new Error("Navn er påkrævet");
    }

    if (!email && !phone) {
      throw new Error("Email eller telefon er påkrævet");
    }

    const taskList = tasks.map((task) => `• ${task}`).join("\n");
    const taskListHtml = tasks.map((task) => `<li>${task}</li>`).join("");

    const results: { email?: boolean; sms?: boolean } = {};

    // Send email if provided
    if (email) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Copenhagen Sales <onboarding@resend.dev>",
            to: [email],
            subject: "Påmindelse: Du har lukkevagt i dag",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Hej ${employeeName}!</h1>
                <p>Dette er en påmindelse om, at du har lukkevagt i dag.</p>
                <h2 style="color: #555;">Husk at:</h2>
                <ul style="line-height: 1.8;">
                  ${taskListHtml}
                </ul>
                <p style="margin-top: 20px; color: #666;">God aften!</p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
                <p style="color: #999; font-size: 12px;">Copenhagen Sales</p>
              </div>
            `,
          }),
        });
        if (emailResponse.ok) {
          console.log("Email sent successfully");
          results.email = true;
        } else {
          const errorText = await emailResponse.text();
          console.error("Email error:", errorText);
        }
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
