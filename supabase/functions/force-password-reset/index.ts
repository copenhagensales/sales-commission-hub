import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ForceResetRequest {
  scope: "all" | "position";
  position_id?: string;
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

    // Verify the user is an owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is owner
    const { data: isOwner } = await supabaseAdmin
      .rpc("is_owner", { _user_id: user.id });

    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: "Kun ejere kan udføre denne handling" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { scope, position_id } = await req.json() as ForceResetRequest;

    console.log(`Force password reset requested. Scope: ${scope}, Position: ${position_id || 'N/A'}`);

    let query = supabaseAdmin
      .from("employee_master_data")
      .update({ must_change_password: true })
      .eq("is_active", true);

    if (scope === "position" && position_id) {
      query = query.eq("position_id", position_id);
    }

    const { data, error } = await query.select("id");

    if (error) {
      console.error("Error updating employees:", error);
      return new Response(
        JSON.stringify({ error: "Kunne ikke opdatere medarbejdere: " + error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const affectedCount = data?.length || 0;
    console.log(`Successfully updated ${affectedCount} employees`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        affected_count: affectedCount,
        message: `${affectedCount} medarbejdere skal nu skifte adgangskode ved næste login`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "En uventet fejl opstod" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
