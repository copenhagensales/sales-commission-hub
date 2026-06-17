// Twilio SMS Status Callback webhook
// Twilio kalder denne URL hver gang en udgående SMS skifter status
// (queued -> sent -> delivered / undelivered / failed).
// Vi opdaterer matching række i communication_logs via twilio_sid.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Twilio sender application/x-www-form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    let params: URLSearchParams;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await req.text();
      params = new URLSearchParams(body);
    } else if (contentType.includes("application/json")) {
      // Fallback hvis nogen tester via JSON
      const json = await req.json();
      params = new URLSearchParams(json as Record<string, string>);
    } else {
      const body = await req.text();
      params = new URLSearchParams(body);
    }

    const messageSid = params.get("MessageSid") || params.get("SmsSid");
    const messageStatus = params.get("MessageStatus") || params.get("SmsStatus");
    const errorCode = params.get("ErrorCode");
    const errorMessage = params.get("ErrorMessage");

    console.log("[twilio-sms-status] callback:", {
      messageSid,
      messageStatus,
      errorCode,
      errorMessage,
    });

    if (!messageSid || !messageStatus) {
      return new Response(
        JSON.stringify({ error: "Missing MessageSid or MessageStatus" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const update: Record<string, unknown> = {
      delivery_status: messageStatus,
      delivery_updated_at: new Date().toISOString(),
    };
    if (errorCode) update.delivery_error_code = errorCode;
    if (errorMessage) update.delivery_error_message = errorMessage;

    const { error: updateError, data: updated } = await supabase
      .from("communication_logs")
      .update(update)
      .eq("twilio_sid", messageSid)
      .select("id");

    if (updateError) {
      console.error("[twilio-sms-status] update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Update failed", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!updated || updated.length === 0) {
      console.warn("[twilio-sms-status] no row matched twilio_sid:", messageSid);
    }

    return new Response(
      JSON.stringify({ ok: true, updated: updated?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[twilio-sms-status] error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
