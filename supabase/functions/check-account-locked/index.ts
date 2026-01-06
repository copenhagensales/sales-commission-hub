import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckRequest {
  email: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email }: CheckRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ locked: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the account is locked by email (private_email or work_email)
    const { data: employee, error } = await supabase
      .from('employee_master_data')
      .select('account_locked, first_name')
      .or(`private_email.ilike.${email},work_email.ilike.${email}`)
      .single();

    if (error || !employee) {
      // If employee not found, allow login attempt (will fail at auth level)
      return new Response(
        JSON.stringify({ locked: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (employee.account_locked) {
      console.log(`Login blocked for locked account: ${email}`);
      return new Response(
        JSON.stringify({ 
          locked: true, 
          message: "Din konto er midlertidigt låst på grund af for mange mislykkede loginforsøg. Kontakt din teamleder for at få den låst op." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ locked: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking account lock:", error);
    // On error, allow login attempt to proceed (fail-open for better UX)
    return new Response(
      JSON.stringify({ locked: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
