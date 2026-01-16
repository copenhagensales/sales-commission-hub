import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known score columns in the database
const KNOWN_SCORE_COLUMNS = [
  'nps_score',
  'development_score',
  'leadership_score',
  'recognition_score',
  'energy_score',
  'seriousness_score',
  'leader_availability_score',
  'wellbeing_score',
  'psychological_safety_score',
  'attrition_risk_score',
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Received pulse survey submission:", JSON.stringify(body, null, 2));

    const {
      survey_id,
      nps_score,
      tenure,
      nps_comment,
      improvement_suggestions,
      submitted_team_id,
      department,
      ...dynamicScores
    } = body;

    // Validate required fields
    if (!survey_id || nps_score === undefined || !tenure) {
      console.error("Missing required fields:", { survey_id, nps_score, tenure });
      return new Response(
        JSON.stringify({ error: "Missing required fields: survey_id, nps_score, tenure" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build insert object with known columns
    const insertData: Record<string, any> = {
      survey_id,
      nps_score,
      tenure,
      nps_comment: nps_comment || null,
      improvement_suggestions: improvement_suggestions || null,
      submitted_team_id: submitted_team_id || null,
      department: department || null,
    };

    // Add all known score columns from the dynamic scores
    for (const column of KNOWN_SCORE_COLUMNS) {
      if (column in dynamicScores && typeof dynamicScores[column] === 'number') {
        insertData[column] = dynamicScores[column];
      }
    }

    console.log("Inserting data:", JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from("pulse_survey_responses")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully inserted response with id:", data.id);

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
