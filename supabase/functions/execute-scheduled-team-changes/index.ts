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

    const today = new Date().toISOString().split("T")[0];

    // Get all pending changes that should be executed today or earlier
    const { data: pendingChanges, error: fetchError } = await supabase
      .from("scheduled_team_changes")
      .select("*")
      .eq("status", "pending")
      .lte("effective_date", today);

    if (fetchError) {
      console.error("Error fetching pending changes:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingChanges || pendingChanges.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending changes to execute", executed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let executedCount = 0;
    const errors: string[] = [];

    for (const change of pendingChanges) {
      try {
        // Insert into team_members (trigger will handle removing from other teams for non-staff)
        const { error: insertError } = await supabase
          .from("team_members")
          .insert({
            employee_id: change.employee_id,
            team_id: change.to_team_id,
          });

        if (insertError) {
          // Check if it's a duplicate key error (already a member)
          if (insertError.code === "23505") {
            console.log(`Employee ${change.employee_id} already in team ${change.to_team_id}, marking as executed`);
          } else {
            throw insertError;
          }
        }

        // Mark as executed
        const { error: updateError } = await supabase
          .from("scheduled_team_changes")
          .update({
            status: "executed",
            executed_at: new Date().toISOString(),
          })
          .eq("id", change.id);

        if (updateError) {
          throw updateError;
        }

        executedCount++;
        console.log(`Executed team change for employee ${change.employee_id}: ${change.from_team_id} -> ${change.to_team_id}`);
      } catch (err) {
        const errorMsg = `Failed to execute change ${change.id}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Executed ${executedCount} team changes`,
        executed: executedCount,
        total: pendingChanges.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
