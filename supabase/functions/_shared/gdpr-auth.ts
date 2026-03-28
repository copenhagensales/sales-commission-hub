import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-gdpr-cron-token",
};

interface AuthResult {
  caller: string;
}

/**
 * Centralized GDPR auth guard.
 * Accepts two authentication methods:
 * 1. Internal cron/scheduler: x-gdpr-cron-token header matching GDPR_CRON_TOKEN env var
 * 2. Owner via JWT: Authorization Bearer token → validated user must have is_owner() = true
 *
 * Returns AuthResult on success, or a Response (401/403) on failure.
 */
export async function authorizeGdprRequest(
  req: Request
): Promise<AuthResult | Response> {
  // Method 1: Internal cron token
  const cronToken = req.headers.get("x-gdpr-cron-token");
  const expectedToken = Deno.env.get("GDPR_CRON_TOKEN");

  if (cronToken) {
    if (!expectedToken) {
      console.error("GDPR_CRON_TOKEN env var not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (cronToken === expectedToken) {
      return { caller: "cron" };
    }
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Method 2: JWT-based owner check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check is_owner via RPC
  const serviceClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: isOwner, error: roleError } = await serviceClient.rpc(
    "is_owner",
    { _user_id: userData.user.id }
  );

  if (roleError || !isOwner) {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return { caller: `owner:${userData.user.email}` };
}

export { corsHeaders };
