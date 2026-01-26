import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  is_staff_employee?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body: CreateUserRequest = await req.json();
    
    // Support both camelCase and snake_case field names
    const email = body.email;
    const password = body.password;
    const firstName = body.firstName || body.first_name;
    const lastName = body.lastName || body.last_name || '';
    const jobTitle = body.job_title;
    const isStaffEmployee = body.is_staff_employee;

    if (!email || !password || !firstName) {
      return new Response(
        JSON.stringify({ error: "Email, password og fornavn er påkrævet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingUser) {
      // Update password for existing user
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password }
      );

      if (updateError) {
        console.error("Password update error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Updated password for existing user ${email}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: existingUser.id,
          message: "Adgangskode opdateret" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: `${firstName} ${lastName}`.trim(),
        email: email,
        email_verified: true,
      }
    });

    if (authError) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created auth user for ${email} with ID: ${authData.user.id}`);

    // Assign default "medarbejder" role
    const { error: roleError } = await supabase
      .from("system_roles")
      .insert({
        user_id: authData.user.id,
        role: "medarbejder"
      });

    if (roleError) {
      console.error("Role assignment error:", roleError);
    } else {
      console.log(`Assigned medarbejder role to user ${authData.user.id}`);
    }

    // Check if employee_master_data record exists, if not create one
    const { data: existingEmployee } = await supabase
      .from("employee_master_data")
      .select("id")
      .or(`private_email.eq.${email},work_email.eq.${email}`)
      .maybeSingle();

    if (!existingEmployee) {
      const employeeData: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName || '',
        private_email: email,
        is_active: true
      };
      
      // Add job_title and is_staff_employee if provided
      if (jobTitle) {
        employeeData.job_title = jobTitle;
      }
      if (isStaffEmployee !== undefined) {
        employeeData.is_staff_employee = isStaffEmployee;
      }
      
      const { error: employeeError } = await supabase
        .from("employee_master_data")
        .insert(employeeData);

      if (employeeError) {
        console.error("Employee creation error:", employeeError);
      } else {
        console.log(`Created employee_master_data record for ${email}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        message: "Bruger oprettet med medarbejder-rolle" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Ukendt fejl" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
