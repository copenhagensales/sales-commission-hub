import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReferralRequest {
  referral_code: string;
  candidate_first_name: string;
  candidate_last_name: string;
  candidate_email: string;
  candidate_phone?: string;
  referrer_name_provided: string;
  message?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data: ReferralRequest = await req.json();

    // Validate required fields
    if (!data.referral_code || !data.candidate_first_name || !data.candidate_last_name || 
        !data.candidate_email || !data.referrer_name_provided) {
      return new Response(
        JSON.stringify({ error: "Manglende påkrævede felter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.candidate_email)) {
      return new Response(
        JSON.stringify({ error: "Ugyldig email-adresse" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate referral code and get referrer
    const { data: referrer, error: referrerError } = await supabase
      .rpc('get_referrer_by_code', { p_referral_code: data.referral_code.toUpperCase() });

    if (referrerError || !referrer || referrer.length === 0) {
      console.error("Invalid referral code:", data.referral_code, referrerError);
      return new Response(
        JSON.stringify({ error: "Ugyldig henvisningskode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const referrerEmployee = referrer[0];
    console.log(`Valid referral code for employee: ${referrerEmployee.first_name} ${referrerEmployee.last_name}`);

    // Check for duplicate email submissions
    const { data: existingReferral } = await supabase
      .from('employee_referrals')
      .select('id')
      .eq('candidate_email', data.candidate_email.toLowerCase())
      .single();

    if (existingReferral) {
      return new Response(
        JSON.stringify({ error: "Denne email er allerede registreret som henvisning" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the referral using service role (bypasses RLS)
    const { data: referral, error: insertError } = await supabase
      .from('employee_referrals')
      .insert({
        referral_code: data.referral_code.toUpperCase(),
        referrer_employee_id: referrerEmployee.id,
        candidate_first_name: data.candidate_first_name.trim(),
        candidate_last_name: data.candidate_last_name.trim(),
        candidate_email: data.candidate_email.toLowerCase().trim(),
        candidate_phone: data.candidate_phone?.trim() || null,
        referrer_name_provided: data.referrer_name_provided.trim(),
        message: data.message?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Kunne ikke oprette henvisning" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Referral created: ${referral.id}`);

    // Send notification email (don't fail if this fails)
    try {
      await supabase.functions.invoke('notify-referral-received', {
        body: {
          referralId: referral.id,
          candidateFirstName: data.candidate_first_name,
          candidateLastName: data.candidate_last_name,
          candidateEmail: data.candidate_email,
          candidatePhone: data.candidate_phone,
          referrerName: data.referrer_name_provided,
          referrerEmployeeName: `${referrerEmployee.first_name} ${referrerEmployee.last_name}`,
          message: data.message,
        },
      });
      console.log("Notification email sent successfully");
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
    }

    return new Response(
      JSON.stringify({ success: true, referral }),
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
