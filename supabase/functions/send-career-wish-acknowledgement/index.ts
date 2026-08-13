import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getM365AccessToken(): Promise<string> {
  const tenantId = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("M365 credentials not configured");
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  if (!response.ok) {
    console.error("M365 token error:", await response.text());
    throw new Error("Failed to get M365 access token");
  }

  const data = await response.json();
  return data.access_token;
}

async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  if (!senderEmail) throw new Error("M365_SENDER_EMAIL not configured");

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
    console.error("Send email error:", await response.text());
    throw new Error(`Failed to send email to ${to}`);
  }
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Validate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { wishId } = await req.json();
    if (!wishId || typeof wishId !== "string") {
      return new Response(JSON.stringify({ error: "wishId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wish, error: wishError } = await admin
      .from("career_wishes")
      .select(
        `id, employee:employee_master_data!career_wishes_employee_id_fkey(first_name, work_email, private_email)`
      )
      .eq("id", wishId)
      .maybeSingle();

    if (wishError) throw wishError;
    if (!wish) {
      return new Response(JSON.stringify({ error: "Karriereønske ikke fundet" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const employee = wish.employee as {
      first_name?: string | null;
      work_email?: string | null;
      private_email?: string | null;
    } | null;

    const recipient = (employee?.work_email || employee?.private_email || "").trim();
    if (!recipient.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Medarbejderen har ingen gyldig e-mailadresse" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstName = escapeHtml((employee?.first_name || "").trim());

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2 style="margin-top: 0;">Tak for dit karriereønske</h2>
            <p>Hej${firstName ? ` ${firstName}` : ""},</p>
            <p>
              Tak for at du har udfyldt dine teamønsker og karriereudvikling — vi har set den.
            </p>
            <p>
              Vi er på den, og vi vender tilbage til dig inden for de næste par dage.
            </p>
            <p style="margin-top: 24px;">Bedste hilsner<br/>Copenhagen Sales</p>
          </div>
        </body>
      </html>
    `;

    const accessToken = await getM365AccessToken();
    await sendEmail(accessToken, recipient, "Tak for dit karriereønske", htmlBody);

    const { error: updateError } = await admin
      .from("career_wishes")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userData.user.id,
      })
      .eq("id", wishId);

    if (updateError) throw updateError;

    console.log(`Career wish acknowledgement sent for ${wishId}`);

    return new Response(JSON.stringify({ success: true, recipient }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-career-wish-acknowledgement error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Ukendt fejl" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
