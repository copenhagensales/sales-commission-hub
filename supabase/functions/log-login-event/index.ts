import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Fire-and-forget: Start the insert but don't wait for it
    // This ensures the function returns quickly
    const insertPromise = supabaseClient
      .from("login_events")
      .insert({
        user_id,
        user_email,
        user_name,
        ip_address,
        user_agent,
        session_id,
      });

    // Use EdgeRuntime.waitUntil if available (Deno Deploy), otherwise just fire and forget
    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
      (globalThis as any).EdgeRuntime.waitUntil(
        insertPromise.then(({ error }) => {
          if (error) console.error("Login event insert error:", error);
        })
      );
    } else {
      // Just fire the promise without awaiting - logs will still capture errors
      insertPromise.then(({ error }: { error: unknown }) => {
        if (error) console.error("Login event insert error:", error);
      });
    }

    // Return immediately without waiting for the insert
    return new Response(
      JSON.stringify({ success: true, queued: true }),
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
