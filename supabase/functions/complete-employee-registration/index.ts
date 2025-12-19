import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegistrationRequest {
  token: string;
  password: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, password }: RegistrationRequest = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Missing token or password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get invitation by token
    const { data: invitationData, error: invError } = await supabase
      .rpc("get_invitation_by_token_v2", { _token: token });

    if (invError || !invitationData || invitationData.length === 0) {
      console.error("Invitation lookup error:", invError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invitation = invitationData[0];
    
    // Check if already completed
    if (invitation.password_set_at) {
      return new Response(
        JSON.stringify({ error: "Registration already completed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, first_name, last_name, employee_id } = invitation;

    console.log(`Creating account for: ${email}`);

    // Check if user already exists in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let authUserId: string;

    if (existingUser) {
      // Update existing user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password }
      );

      if (updateError) {
        console.error("Password update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      authUserId = existingUser.id;
      console.log(`Password updated for existing user: ${email}`);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
        },
      });

      if (createError) {
        console.error("User creation error:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      authUserId = newUser.user.id;

      // Assign default role
      const { error: roleError } = await supabase
        .from("system_roles")
        .insert({
          user_id: authUserId,
          role: "medarbejder",
        });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }

      console.log(`New user created: ${email}`);
    }

    // Mark invitation password as set and complete
    const { data: completeResult } = await supabase.rpc("complete_invitation_password", { _token: token });
    
    if (!completeResult?.success) {
      console.warn("Failed to mark invitation complete, but account was created");
    }

    // Update employee with auth_user_id
    await supabase
      .from("employee_master_data")
      .update({ 
        auth_user_id: authUserId,
        invitation_status: "completed"
      })
      .eq("id", employee_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account created successfully",
        email
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
