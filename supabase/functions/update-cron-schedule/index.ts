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

// Map integration type to edge function name
const typeToFunction: Record<string, string> = {
  adversus: "sync-adversus",
  economic: "sync-economic",
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

    const { integration_type, frequency_minutes, is_active } = await req.json();

    if (!integration_type) {
      return new Response(
        JSON.stringify({ error: "integration_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const functionName = typeToFunction[integration_type];
    if (!functionName) {
      return new Response(
        JSON.stringify({ error: `Unknown integration type: ${integration_type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobName = `${integration_type}-sync-scheduled`;
    console.log(`Updating cron job: ${jobName}, frequency: ${frequency_minutes}, active: ${is_active}`);

    // First, try to unschedule any existing job with this name
    try {
      await supabase.rpc("cron_unschedule", { job_name: jobName });
      console.log(`Unscheduled existing job: ${jobName}`);
    } catch (e) {
      // Job might not exist, that's okay
      console.log(`No existing job to unschedule: ${jobName}`);
    }

    // If active and has frequency, create new cron job
    if (is_active && frequency_minutes && frequencyToCron[frequency_minutes]) {
      const cronExpression = frequencyToCron[frequency_minutes];
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
      
      // Build the SQL command for the cron job
      const sqlCommand = `
        SELECT net.http_post(
          url := '${functionUrl}',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
          body := '{"syncDays": 7}'::jsonb
        ) AS request_id;
      `;

      // Schedule the new cron job using raw SQL
      const { error: scheduleError } = await supabase.rpc("cron_schedule", {
        job_name: jobName,
        schedule: cronExpression,
        command: sqlCommand,
      });

      if (scheduleError) {
        console.error("Error scheduling cron job:", scheduleError);
        
        // Fallback: Try direct SQL execution
        const { error: directError } = await supabase
          .from("_internal_cron")
          .select("*")
          .limit(0);
          
        if (directError) {
          console.log("Direct approach not available, using alternative method");
        }
        
        // Use the cron.schedule function directly via SQL
        const { data, error: sqlError } = await supabase.rpc("exec_sql", {
          sql: `SELECT cron.schedule('${jobName}', '${cronExpression}', $$ ${sqlCommand} $$);`
        });
        
        if (sqlError) {
          console.error("SQL execution error:", sqlError);
          throw new Error(`Failed to schedule cron job: ${sqlError.message}`);
        }
      }

      console.log(`Scheduled new cron job: ${jobName} with schedule: ${cronExpression}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Cron job updated: ${jobName}`,
          schedule: cronExpression,
          function: functionName,
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

  } catch (error: any) {
    console.error("Error updating cron schedule:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
