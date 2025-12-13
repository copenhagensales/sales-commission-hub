import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      survey_id,
      nps_score,
      tenure,
      development_score,
      leadership_score,
      recognition_score,
      energy_score,
      seriousness_score,
      leader_availability_score,
      wellbeing_score,
      psychological_safety_score,
      nps_comment,
      improvement_suggestions,
      submitted_team_id,
      department,
    } = body;

    // Validate required fields
    if (!survey_id || nps_score === undefined || !tenure) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("pulse_survey_responses")
      .insert({
        survey_id,
        nps_score,
        tenure,
        development_score,
        leadership_score,
        recognition_score,
        energy_score,
        seriousness_score,
        leader_availability_score,
        wellbeing_score,
        psychological_safety_score,
        nps_comment: nps_comment || null,
        improvement_suggestions: improvement_suggestions || null,
        submitted_team_id: submitted_team_id || null,
        department: department || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Function error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
