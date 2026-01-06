import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LogFailedLoginRequest {
  email: string;
  failure_reason?: string;
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

    const { email, failure_reason } = await req.json() as LogFailedLoginRequest;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP and user agent from request headers
    const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                       req.headers.get("x-real-ip") || 
                       "unknown";
    const user_agent = req.headers.get("user-agent") || null;

    // Log the failed attempt
    const { error: logError } = await supabaseAdmin
      .from("failed_login_attempts")
      .insert({
        email,
        ip_address,
        user_agent,
        failure_reason: failure_reason || "invalid_credentials",
      });

    if (logError) {
      console.error("Error logging failed attempt:", logError);
    }

    // Increment failed login count for the employee
    const { data: employee } = await supabaseAdmin
      .from("employee_master_data")
      .select("id, failed_login_count, account_locked")
      .eq("private_email", email.toLowerCase())
      .maybeSingle();

    if (employee && !employee.account_locked) {
      const newCount = (employee.failed_login_count || 0) + 1;
      const shouldLock = newCount >= 5;

      await supabaseAdmin
        .from("employee_master_data")
        .update({
          failed_login_count: newCount,
          account_locked: shouldLock,
          locked_at: shouldLock ? new Date().toISOString() : null,
        })
        .eq("id", employee.id);

      if (shouldLock) {
        console.log(`Account locked for ${email} after ${newCount} failed attempts`);
      }
    }

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
