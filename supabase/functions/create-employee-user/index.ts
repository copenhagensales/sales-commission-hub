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

    // Verify caller is authenticated and is manager or above
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isManager } = await supabase.rpc("is_manager_or_above", { _user_id: callingUser.id });
    if (!isManager) {
      return new Response(
        JSON.stringify({ error: "Kun ledere kan oprette brugere" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreateUserRequest = await req.json();
    
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

      // Link auth_user_id on employee record
      const { error: linkError } = await supabase
        .from("employee_master_data")
        .update({ auth_user_id: existingUser.id })
        .or(`private_email.ilike.${email},work_email.ilike.${email}`)
        .is("auth_user_id", null);
      if (linkError) console.error("Error linking auth_user_id:", linkError);

      // Check if employee_master_data record exists, if not create one
      const { data: existingEmp } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${email},work_email.ilike.${email}`)
        .maybeSingle();

      if (!existingEmp) {
        console.log(`No employee record found for existing user ${email}, creating one`);
        const employeeData: Record<string, unknown> = {
          first_name: firstName,
          last_name: lastName || '',
          private_email: email,
          is_active: true,
          auth_user_id: existingUser.id,
        };
        if (jobTitle) employeeData.job_title = jobTitle;
        if (isStaffEmployee !== undefined) employeeData.is_staff_employee = isStaffEmployee;

        const { error: empError } = await supabase
          .from("employee_master_data")
          .insert(employeeData);
        if (empError) console.error("Error creating employee record:", empError);
        else console.log(`Created employee_master_data for existing user ${email}`);
      }

      // Assign medarbejder role if not already assigned
      const { data: existingRole } = await supabase
        .from("system_roles")
        .select("id")
        .eq("user_id", existingUser.id)
        .maybeSingle();
      if (!existingRole) {
        const { error: roleError } = await supabase
          .from("system_roles")
          .insert({ user_id: existingUser.id, role: "medarbejder" });
        if (roleError) console.error("Error assigning role:", roleError);
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
    const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: `${firstName} ${lastName}`.trim(),
        email: email,
        email_verified: true,
      }
    });

    if (createAuthError) {
      console.error("Auth error:", createAuthError);
      return new Response(
        JSON.stringify({ error: createAuthError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created auth user for ${email} with ID: ${authData.user.id}`);

    // Assign default "medarbejder" role
    const { error: roleError } = await supabase
      .from("system_roles")
      .insert({ user_id: authData.user.id, role: "medarbejder" });
    if (roleError) console.error("Role assignment error:", roleError);
    else console.log(`Assigned medarbejder role to user ${authData.user.id}`);

    // Check if employee_master_data record exists
    const { data: existingEmployee } = await supabase
      .from("employee_master_data")
      .select("id")
      .or(`private_email.eq.${email},work_email.eq.${email}`)
      .maybeSingle();

    if (existingEmployee) {
      const { error: linkError } = await supabase
        .from("employee_master_data")
        .update({ auth_user_id: authData.user.id })
        .eq("id", existingEmployee.id);
      if (linkError) console.error("Error linking auth_user_id:", linkError);
      else console.log(`Linked auth_user_id for existing employee ${email}`);
    } else {
      // Lookup position_id from job_title
      let positionId: string | null = null;
      if (jobTitle) {
        const { data: posData } = await supabase
          .from("job_positions")
          .select("id")
          .ilike("name", jobTitle.trim())
          .maybeSingle();
        if (posData) positionId = posData.id;
      }

      const employeeData: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName || '',
        private_email: email,
        is_active: true,
        auth_user_id: authData.user.id,
      };
      if (jobTitle) employeeData.job_title = jobTitle;
      if (positionId) employeeData.position_id = positionId;
      if (isStaffEmployee !== undefined) employeeData.is_staff_employee = isStaffEmployee;
      
      const { error: employeeError } = await supabase
        .from("employee_master_data")
        .insert(employeeData);
      if (employeeError) console.error("Employee creation error:", employeeError);
      else console.log(`Created employee_master_data record for ${email}`);
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
