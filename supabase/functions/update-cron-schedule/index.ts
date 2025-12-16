import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map sync_frequency_minutes to cron expressions
const frequencyToCron: Record<number, string> = {
  15: "*/15 * * * *",      // Every 15 minutes
  30: "*/30 * * * *",      // Every 30 minutes
  60: "0 * * * *",         // Every hour
  120: "0 */2 * * *",      // Every 2 hours
  360: "0 */6 * * *",      // Every 6 hours
  720: "0 */12 * * *",     // Every 12 hours
  1440: "0 6 * * *",       // Daily at 6 AM
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { integration_type, integration_id, provider, frequency_minutes, is_active } = await req.json();

    console.log(`[update-cron-schedule] type=${integration_type}, id=${integration_id}, freq=${frequency_minutes}, active=${is_active}`);

    // For dialer integrations, use integration_id in job name
    let jobName: string;
    let functionName: string;
    let payload: object;

    if (integration_type === "dialer") {
      if (!integration_id) {
        return new Response(
          JSON.stringify({ error: "integration_id is required for dialer type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      jobName = `dialer-${integration_id.slice(0, 8)}-sync`;
      functionName = "integration-engine";
      payload = { 
        source: provider || "adversus", 
        integration_id, 
        action: "sync", 
        days: 2 
      };
    } else {
      // Legacy support for other integration types
      const typeToFunction: Record<string, string> = {
        adversus: "integration-engine",
        economic: "sync-economic",
      };
      
      if (!integration_type || !typeToFunction[integration_type]) {
        return new Response(
          JSON.stringify({ error: `Unknown integration type: ${integration_type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      jobName = `${integration_type}-sync-scheduled`;
      functionName = typeToFunction[integration_type];
      payload = integration_type === "adversus" 
        ? { source: "adversus", action: "sync", days: 2 }
        : {};
    }

    console.log(`[update-cron-schedule] jobName=${jobName}, function=${functionName}`);

    // First, try to unschedule any existing job with this name
    try {
      const { error: unscheduleError } = await supabase.rpc("unschedule_integration_sync", { 
        p_job_name: jobName 
      });
      if (unscheduleError) {
        console.log(`Could not unschedule existing job (may not exist): ${unscheduleError.message}`);
      } else {
        console.log(`Unscheduled existing job: ${jobName}`);
      }
    } catch (e) {
      console.log(`No existing job to unschedule: ${jobName}`);
    }

    // If active and has frequency, create new cron job
    if (is_active && frequency_minutes && frequencyToCron[frequency_minutes]) {
      const cronExpression = frequencyToCron[frequency_minutes];
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
      
      console.log(`[update-cron-schedule] Scheduling: ${cronExpression} -> ${functionUrl}`);
      console.log(`[update-cron-schedule] Payload: ${JSON.stringify(payload)}`);

      // Schedule the new cron job using the RPC function with full payload
      const { data: scheduleData, error: scheduleError } = await supabase.rpc("schedule_integration_sync", {
        p_job_name: jobName,
        p_schedule: cronExpression,
        p_function_url: functionUrl,
        p_anon_key: anonKey,
        p_payload: payload,
      });

      if (scheduleError) {
        console.error("Error scheduling cron job via RPC:", scheduleError);
        throw new Error(`Failed to schedule cron job: ${scheduleError.message}`);
      }

      console.log(`Scheduled new cron job: ${jobName} with schedule: ${cronExpression}, jobId: ${scheduleData}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Cron job updated: ${jobName}`,
          schedule: cronExpression,
          function: functionName,
          jobId: scheduleData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If not active or no frequency, just confirm the job was removed
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cron job disabled: ${jobName}`,
        schedule: null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating cron schedule:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
