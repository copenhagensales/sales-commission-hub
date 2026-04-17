import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KNOWN_SCORE_COLUMNS = [
  'nps_score', 'development_score', 'leadership_score', 'recognition_score',
  'energy_score', 'seriousness_score', 'leader_availability_score', 'wellbeing_score',
  'psychological_safety_score', 'attrition_risk_score', 'product_competitiveness_score',
  'market_fit_score', 'interest_creation_score', 'campaign_attractiveness_score',
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      survey_id,
      selected_team_id,
      nps_score,
      tenure,
      nps_comment,
      improvement_suggestions,
      campaign_improvement_suggestions,
      ...dynamicScores
    } = body;

    if (!survey_id || nps_score === undefined || !tenure || !selected_team_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find employee by auth_user_id, fallback to email
    const lowerEmail = (user.email || "").toLowerCase();
    let employeeId: string | null = null;

    const { data: empByAuth } = await supabase
      .from("employee_master_data")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (empByAuth) {
      employeeId = empByAuth.id;
    } else if (lowerEmail) {
      const { data: empByEmail } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();
      if (empByEmail) {
        employeeId = empByEmail.id;
        // Link auth_user_id for future
        await supabase
          .from("employee_master_data")
          .update({ auth_user_id: user.id })
          .eq("id", employeeId);
      }
    }

    if (!employeeId) {
      return new Response(
        JSON.stringify({ error: "Employee not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency: if already completed, return success
    const { data: existingCompletion } = await supabase
      .from("pulse_survey_completions")
      .select("id")
      .eq("survey_id", survey_id)
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (existingCompletion) {
      // Clean up draft just in case
      await supabase
        .from("pulse_survey_drafts")
        .delete()
        .eq("survey_id", survey_id)
        .eq("employee_id", employeeId);
      return new Response(
        JSON.stringify({ success: true, alreadyCompleted: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get team name
    let teamName: string | null = null;
    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", selected_team_id)
      .maybeSingle();
    teamName = team?.name || null;

    // Build response insert
    const insertData: Record<string, any> = {
      survey_id,
      team_id: selected_team_id,
      department: teamName,
      nps_score,
      tenure,
      nps_comment: nps_comment || null,
      improvement_suggestions: improvement_suggestions || null,
      campaign_improvement_suggestions: campaign_improvement_suggestions || null,
    };

    for (const column of KNOWN_SCORE_COLUMNS) {
      if (column in dynamicScores && typeof dynamicScores[column] === "number") {
        insertData[column] = dynamicScores[column];
      }
    }

    // Step 1: Insert response
    const { data: responseRow, error: responseError } = await supabase
      .from("pulse_survey_responses")
      .insert(insertData)
      .select("id")
      .single();

    if (responseError) {
      console.error("Response insert error:", responseError);
      return new Response(
        JSON.stringify({ error: `Failed to save response: ${responseError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Insert completion (CRITICAL — must succeed)
    const { error: completionError } = await supabase
      .from("pulse_survey_completions")
      .insert({ survey_id, employee_id: employeeId });

    if (completionError) {
      // Rollback response to avoid orphaned data
      console.error("Completion insert failed, rolling back response:", completionError);
      await supabase.from("pulse_survey_responses").delete().eq("id", responseRow.id);
      return new Response(
        JSON.stringify({ error: `Failed to mark completion: ${completionError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Delete draft (best-effort)
    await supabase
      .from("pulse_survey_drafts")
      .delete()
      .eq("survey_id", survey_id)
      .eq("employee_id", employeeId);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Function error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
