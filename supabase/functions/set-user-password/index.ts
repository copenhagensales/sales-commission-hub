import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SetPasswordRequest {
  email: string;
  newPassword: string;
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

    const { email, newPassword } = await req.json() as SetPasswordRequest;

    if (!email || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Email og adgangskode er påkrævet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "Adgangskoden skal være mindst 6 tegn" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Kunne ikke finde brugere" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    // If user doesn't exist, create them
    if (!user) {
      console.log(`User not found, creating new user for: ${email}`);
      
      // Get employee name from employee_master_data for user metadata
      const { data: employee } = await supabaseAdmin
        .from("employee_master_data")
        .select("first_name, last_name")
        .eq("private_email", email)
        .maybeSingle();
      
      const fullName = employee 
        ? `${employee.first_name} ${employee.last_name}` 
        : email.split("@")[0];
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          name: fullName,
        }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Kunne ikke oprette bruger: " + createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Assign medarbejder role
      if (newUser?.user) {
        const { error: roleError } = await supabaseAdmin
          .from("system_roles")
          .insert({ user_id: newUser.user.id, role: "medarbejder" });
        
        if (roleError) {
          console.error("Error assigning role:", roleError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Bruger oprettet med adgangskode", created: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update existing user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Kunne ikke opdatere adgangskoden: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Adgangskode opdateret" }),
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
