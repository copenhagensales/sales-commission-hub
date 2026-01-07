import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with the user's token to verify their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      console.error("Error getting calling user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is a manager or above
    const { data: isManager, error: managerError } = await supabaseUser.rpc("is_manager_or_above");
    if (managerError || !isManager) {
      console.error("Manager check failed:", managerError);
      return new Response(
        JSON.stringify({ error: "Kun ledere kan nulstille MFA for andre brugere" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email } = await req.json();
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email er påkrævet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${callingUser.email} attempting to reset MFA for: ${email}`);

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find the target user by email in auth.users
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Kunne ikke hente brugerliste" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: "Bruger ikke fundet" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found target user: ${targetUser.id}`);

    // List MFA factors for the user
    const { data: factorsData, error: factorsError } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: targetUser.id,
    });

    if (factorsError) {
      console.error("Error listing MFA factors:", factorsError);
      return new Response(
        JSON.stringify({ error: "Kunne ikke hente MFA faktorer" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${factorsData?.factors?.length || 0} MFA factors`);

    // Delete all TOTP factors
    let deletedCount = 0;
    if (factorsData?.factors) {
      for (const factor of factorsData.factors) {
        if (factor.factor_type === "totp") {
          const { error: deleteError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
            userId: targetUser.id,
            id: factor.id,
          });

          if (deleteError) {
            console.error(`Error deleting factor ${factor.id}:`, deleteError);
          } else {
            deletedCount++;
            console.log(`Deleted factor: ${factor.id}`);
          }
        }
      }
    }

    // Update employee_master_data to set mfa_enabled = false
    const { error: updateError } = await supabaseAdmin
      .from("employee_master_data")
      .update({ mfa_enabled: false })
      .or(`work_email.ilike.${email},private_email.ilike.${email}`);

    if (updateError) {
      console.error("Error updating employee_master_data:", updateError);
      // Don't fail the request, just log - the MFA factors were still deleted
    }

    console.log(`Successfully reset MFA for ${email}. Deleted ${deletedCount} factors.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `MFA er nulstillet for ${email}`,
        deletedFactors: deletedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Der opstod en uventet fejl" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
