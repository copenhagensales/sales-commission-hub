import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BatchRequest {
  password: string;
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

    const { password } = await req.json() as BatchRequest;

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password skal være mindst 6 tegn" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active Fieldmarketing employees
    const { data: employees, error: fetchError } = await supabaseAdmin
      .from("employee_master_data")
      .select("id, first_name, last_name, private_email, work_email")
      .eq("job_title", "Fieldmarketing")
      .eq("is_active", true);

    if (fetchError) {
      console.error("Error fetching employees:", fetchError);
      return new Response(
        JSON.stringify({ error: "Kunne ikke hente medarbejdere" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { email: string; success: boolean; error?: string; created?: boolean }[] = [];

    for (const emp of employees || []) {
      const email = emp.private_email || emp.work_email;
      if (!email) {
        results.push({ email: `${emp.first_name} ${emp.last_name}`, success: false, error: "Ingen email" });
        continue;
      }

      try {
        // Check if user exists
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        let user = users?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (!user) {
          // Create new user
          const fullName = `${emp.first_name} ${emp.last_name}`;
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { name: fullName }
          });

          if (createError) {
            results.push({ email, success: false, error: createError.message });
            continue;
          }

          // Assign medarbejder role
          if (newUser?.user) {
            await supabaseAdmin
              .from("system_roles")
              .insert({ user_id: newUser.user.id, role: "medarbejder" });

            // Update employee with auth_user_id and must_change_password flag
            await supabaseAdmin
              .from("employee_master_data")
              .update({ 
                auth_user_id: newUser.user.id,
                must_change_password: true 
              })
              .eq("id", emp.id);
          }

          results.push({ email, success: true, created: true });
        } else {
          // Update existing user's password
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: password }
          );

          if (updateError) {
            results.push({ email, success: false, error: updateError.message });
            continue;
          }

          // Update must_change_password flag
          await supabaseAdmin
            .from("employee_master_data")
            .update({ 
              auth_user_id: user.id,
              must_change_password: true 
            })
            .eq("id", emp.id);

          results.push({ email, success: true, created: false });
        }
      } catch (err) {
        results.push({ email, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${successCount} passwords sat, ${failCount} fejl`,
        total: employees?.length || 0,
        successCount,
        failCount,
        results 
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
