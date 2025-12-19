import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompleteResetRequest {
  token: string;
  newPassword: string;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, newPassword }: CompleteResetRequest = await req.json();

    if (!token || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Missing token or password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the provided token
    const tokenHash = await hashToken(token);

    // Validate token using RPC function
    const { data: tokenData, error: tokenError } = await supabase
      .rpc("validate_password_reset_token", { _token_hash: tokenHash });

    if (tokenError || !tokenData || tokenData.length === 0) {
      console.error("Token validation error:", tokenError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetData = tokenData[0];
    const { email, first_name, last_name } = resetData;

    console.log(`Processing password reset for: ${email}`);

    // Check if user exists in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // Update existing user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error("Password update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Password updated for existing user: ${email}`);
    } else {
      // Create new user with the password
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          first_name: first_name,
          last_name: last_name,
        },
      });

      if (createError) {
        console.error("User creation error:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Assign default role
      if (newUser?.user) {
        const { error: roleError } = await supabase
          .from("system_roles")
          .insert({
            user_id: newUser.user.id,
            role: "medarbejder",
          });

        if (roleError) {
          console.error("Role assignment error:", roleError);
        }
      }

      console.log(`New user created: ${email}`);
    }

    // Mark token as used
    const { data: consumed } = await supabase.rpc("consume_password_reset_token", { _token_hash: tokenHash });
    
    if (!consumed) {
      console.warn("Failed to consume token, but password was reset successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: existingUser ? "Password updated successfully" : "Account created successfully",
        isNewUser: !existingUser
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
