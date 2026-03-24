import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function sendEmail(accessToken: string, recipients: string[], subject: string, htmlBody: string): Promise<void> {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  if (!senderEmail) throw new Error("Missing M365_SENDER_EMAIL");

  const toRecipients = recipients.map(email => ({
    emailAddress: { address: email },
  }));

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
          toRecipients,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Send email error:", error);
    throw new Error(`Failed to send email: ${response.status}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const {
      booking_id,
      vehicle_id,
      vehicle_name,
      booking_date,
      photo_url,
      employee_id,
    } = await req.json();

    console.log("[notify-vehicle-returned] START", {
      booking_id,
      vehicle_id,
      vehicle_name,
      booking_date,
      employee_id: employee_id?.slice(0, 8),
      has_photo: !!photo_url,
    });

    if (!booking_id || !vehicle_id || !vehicle_name || !booking_date || !employee_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: booking_id, vehicle_id, vehicle_name, booking_date, employee_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Look up employee name
    const { data: emp, error: empError } = await supabase
      .from("employee_master_data")
      .select("first_name, last_name")
      .eq("id", employee_id)
      .single();

    if (empError || !emp) {
      console.error("Employee lookup failed:", empError);
      return new Response(
        JSON.stringify({ error: "Employee not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const employeeName = `${emp.first_name} ${emp.last_name}`;
    console.log("[notify-vehicle-returned] Employee:", employeeName);

    // 2. Upsert vehicle_return_confirmation
    const upsertPayload: Record<string, any> = {
      booking_id,
      vehicle_id,
      employee_id,
      vehicle_name,
      booking_date,
    };
    if (photo_url) upsertPayload.photo_url = photo_url;

    const { error: upsertError } = await supabase
      .from("vehicle_return_confirmation")
      .upsert(upsertPayload, { onConflict: "booking_id,vehicle_id,booking_date" });

    if (upsertError) {
      console.error("Upsert failed:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save confirmation: " + upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[notify-vehicle-returned] Confirmation saved");

    // 3. Find FM assistant team leaders via junction table
    const { data: fmTeams } = await supabase
      .from("teams")
      .select("id")
      .ilike("name", "%fieldmarketing%");

    const fmTeamIds = (fmTeams ?? []).map((t: any) => t.id);
    console.log("[notify-vehicle-returned] FM teams found:", fmTeamIds.length);

    let recipientEmails: string[] = [];

    if (fmTeamIds.length > 0) {
      const { data: assistants } = await supabase
        .from("team_assistant_leaders")
        .select("employee_id")
        .in("team_id", fmTeamIds);

      const assistantIds = (assistants ?? []).map((a: any) => a.employee_id);
      console.log("[notify-vehicle-returned] Assistant leader IDs:", assistantIds);

      if (assistantIds.length > 0) {
        const { data: employees } = await supabase
          .from("employee_master_data")
          .select("work_email, private_email, first_name")
          .in("id", assistantIds)
          .eq("is_active", true);

        recipientEmails = (employees ?? [])
          .map((e: any) => e.work_email || e.private_email)
          .filter(Boolean);

        console.log("[notify-vehicle-returned] Recipient emails:", recipientEmails);
      }
    }

    if (recipientEmails.length === 0) {
      console.warn("[notify-vehicle-returned] No FM leaders found to notify");
      return new Response(
        JSON.stringify({ ok: true, confirmed: true, notified: 0, recipients: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Send email
    const accessToken = await getM365AccessToken();

    const photoHtml = photo_url
      ? `<p style="margin-top: 12px;"><strong>Billede af nøgleaflevering:</strong></p><img src="${photo_url}" alt="Nøgle aflevering" style="max-width: 400px; border-radius: 8px; border: 1px solid #e5e7eb;" />`
      : "";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #b45309;">🔑 Nøgle afleveret</h2>
        <p><strong>${employeeName}</strong> har bekræftet aflevering af nøgle til <strong>${vehicle_name}</strong>.</p>
        <p>Dato: <strong>${booking_date}</strong></p>
        ${photoHtml}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="font-size: 12px; color: #6b7280;">Denne email er sendt automatisk fra Copenhagen Sales vagtplan.</p>
      </div>
    `;

    await sendEmail(accessToken, recipientEmails, `Nøgle afleveret: ${vehicle_name} (${booking_date})`, htmlBody);
    console.log("[notify-vehicle-returned] Email sent successfully to", recipientEmails.length, "recipients");

    return new Response(
      JSON.stringify({ ok: true, confirmed: true, notified: recipientEmails.length, recipients: recipientEmails }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[notify-vehicle-returned] ERROR:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
