import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id, user_email, user_name, session_id } = await req.json();

    if (!user_id || !user_email) {
      return new Response(
        JSON.stringify({ error: "user_id and user_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP address from headers
    const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                       req.headers.get("cf-connecting-ip") ||
                       req.headers.get("x-real-ip") ||
                       null;

    // Get user agent
    const user_agent = req.headers.get("user-agent") || null;

    // Insert login event
    const { error } = await supabaseClient
      .from("login_events")
      .insert({
        user_id,
        user_email,
        user_name,
        ip_address,
        user_agent,
        session_id,
      });

    if (error) {
      console.error("Error inserting login event:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in log-login-event:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
