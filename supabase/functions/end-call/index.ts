import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;

    const authHeader = req.headers.get("authorization") || "";

    // Authenticated endpoint (UI only)
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims();
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const callSid = String(body?.callSid || "").trim();

    if (!callSid) {
      return new Response(JSON.stringify({ error: "Missing callSid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[end-call] Request", {
      callSid,
      userId: claimsData.claims.sub,
      ts: new Date().toISOString(),
    });

    // End call in Twilio
    const basicAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      twilioAccountSid,
    )}/Calls/${encodeURIComponent(callSid)}.json`;

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Status: "completed" }).toString(),
    });

    const twilioText = await twilioRes.text();
    if (!twilioRes.ok) {
      console.error("[end-call] Twilio error", {
        status: twilioRes.status,
        body: twilioText,
      });

      return new Response(JSON.stringify({ error: "Failed to end call" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort: update DB record so UI reflects ended state immediately
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { error: dbError } = await admin
      .from("call_records")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("twilio_call_sid", callSid);

    if (dbError) {
      console.error("[end-call] DB update error", dbError);
    }

    console.log("[end-call] Success", { callSid });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[end-call] Unexpected error", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
