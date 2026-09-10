import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LogFailedLoginRequest {
  email?: string | null;
  failure_reason?: string;
  origin?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, failure_reason, origin } = await req.json() as LogFailedLoginRequest;

    // Email er optional: ved SSO-fejl oplyser Entra ikke hvem der forsøgte.
    let emailValue: string | null = null;
    if (typeof email === "string" && email.trim() !== "") {
      const trimmed = email.trim();
      if (trimmed.length > 255 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
        return new Response(
          JSON.stringify({ error: "Invalid email format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      emailValue = trimmed;
    }

    const originValue = typeof origin === "string" && origin.trim() !== ""
      ? origin.trim().slice(0, 255)
      : null;

    const reasonValue = typeof failure_reason === "string" && failure_reason.trim() !== ""
      ? failure_reason.slice(0, 1000)
      : "invalid_credentials";

    // Get IP and user agent from request headers
    const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                       req.headers.get("x-real-ip") || 
                       "unknown";
    const user_agent = req.headers.get("user-agent") || null;

    // Log the failed attempt
    const { error: logError } = await supabaseAdmin
      .from("failed_login_attempts")
      .insert({
        email: emailValue,
        ip_address,
        user_agent,
        failure_reason: reasonValue,
        origin: originValue,
      });

    if (logError) {
      console.error("Error logging failed attempt:", logError);
    }

    // SECURITY: Dette endpoint er offentligt (kaldes før login lykkes), og må derfor
    // IKKE kunne låse konti. Tidligere blev failed_login_count/account_locked opdateret
    // her, hvilket gav enhver mulighed for at låse en kollegas konto (denial of service).
    // Nu logges forsøget udelukkende til revisionsspor.

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in log-failed-login:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
