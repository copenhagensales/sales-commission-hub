import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map sync_frequency_minutes to cron expressions
const frequencyToCron: Record<number, string> = {
  5: "*/5 * * * *",
  15: "*/15 * * * *",
  30: "*/30 * * * *",
  60: "0 * * * *",
  120: "0 */2 * * *",
  360: "0 */6 * * *",
  720: "0 */12 * * *",
  1440: "0 6 * * *",
};

const staggeredFiveMinuteSchedules: Record<string, string> = {
  lovablecph: "1,6,11,16,21,26,31,36,41,46,51,56 * * * *",
  relatel_cphsales: "3,8,13,18,23,28,33,38,43,48,53,58 * * * *",
  eesy: "0,5,10,15,20,25,30,35,40,45,50,55 * * * *",
  tryg: "2,7,12,17,22,27,32,37,42,47,52,57 * * * *",
  ase: "4,9,14,19,24,29,34,39,44,49,54,59 * * * *",
};

const getDialerSchedule = (
  integrationName?: string | null,
  config?: Record<string, unknown> | null,
  frequencyMinutes?: number | null,
): string | null => {
  const configSchedule = config?.sync_schedule;
  if (typeof configSchedule === "string" && configSchedule.trim()) {
    return configSchedule.trim();
  }

  if (frequencyMinutes === 5) {
    const normalizedName = (integrationName || "").trim().toLowerCase();
    if (staggeredFiveMinuteSchedules[normalizedName]) {
      return staggeredFiveMinuteSchedules[normalizedName];
    }
  }

  return null;
};

const getSyncDays = (integrationName?: string | null, config?: Record<string, unknown> | null): number => {
  const configDays = config?.sync_days;
  if (typeof configDays === "number" && Number.isFinite(configDays) && configDays >= 1) {
    return Math.floor(configDays);
  }

  if ((integrationName || "").toLowerCase().includes("ase")) {
    return 3;
  }

  return 1;
};

async function insertAuditEntry(
  supabase: any,
  integrationId: string,
  changeType: string,
  oldSchedule: string | null,
  newSchedule: string | null,
  oldConfig: Record<string, unknown> | null,
  newConfig: Record<string, unknown> | null,
) {
  try {
    await supabase.from("integration_schedule_audit").insert({
      integration_id: integrationId,
      change_type: changeType,
      old_schedule: oldSchedule,
      new_schedule: newSchedule,
      old_config: oldConfig,
      new_config: newConfig,
    });
    console.log(`[update-cron-schedule] Audit entry created: ${changeType}`);
  } catch (e) {
    console.error(`[update-cron-schedule] Failed to create audit entry:`, e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { integration_type, integration_id, provider, frequency_minutes, is_active, custom_schedule } = await req.json();

    console.log(`[update-cron-schedule] type=${integration_type}, id=${integration_id}, freq=${frequency_minutes}, active=${is_active}, custom=${custom_schedule}`);

    let jobName: string;
    let functionName: string;
    let payload: object;
    let integrationMetadata: { name?: string; config?: Record<string, unknown> | null } | null = null;
    let previousSchedule: string | null = null;

    if (integration_type === "dialer") {
      if (!integration_id) {
        return new Response(
          JSON.stringify({ error: "integration_id is required for dialer type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      jobName = `dialer-${integration_id.slice(0, 8)}-sync`;
      functionName = "integration-engine";

      const { data: integrationData, error: integrationLookupError } = await supabase
        .from("dialer_integrations")
        .select("name, config, sync_frequency_minutes")
        .eq("id", integration_id)
        .maybeSingle();

      integrationMetadata = integrationData
        ? {
            name: integrationData.name,
            config: (integrationData.config as Record<string, unknown> | null) ?? null,
          }
        : null;

      // Capture previous schedule for audit
      if (integrationData?.config) {
        const cfg = integrationData.config as Record<string, unknown>;
        previousSchedule = (cfg.sync_schedule as string) || null;
      }
      if (!previousSchedule && integrationData?.sync_frequency_minutes) {
        previousSchedule = frequencyToCron[integrationData.sync_frequency_minutes] || null;
      }

      if (integrationLookupError) {
        console.warn(`[update-cron-schedule] Could not load integration metadata for ${integration_id}: ${integrationLookupError.message}`);
      }

      const syncDays = getSyncDays(integrationMetadata?.name, integrationMetadata?.config);

      payload = { 
        source: provider || "adversus", 
        integration_id, 
        actions: ["campaigns", "users", "sales", "sessions"], 
        days: syncDays 
      };
    } else {
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
        ? { source: "adversus", action: "sync", days: 1 }
        : {};
    }

    console.log(`[update-cron-schedule] jobName=${jobName}, function=${functionName}`);

    // Unschedule existing job
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

    const dialerSchedule = integration_type === "dialer"
      ? getDialerSchedule(integrationMetadata?.name, integrationMetadata?.config, frequency_minutes)
      : null;

    if (is_active && (custom_schedule || dialerSchedule || (frequency_minutes && frequencyToCron[frequency_minutes]))) {
      const cronExpression = custom_schedule || dialerSchedule || frequencyToCron[frequency_minutes];
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
      
      console.log(`[update-cron-schedule] Scheduling: ${cronExpression} -> ${functionUrl}`);

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

      // Audit log
      if (integration_id) {
        await insertAuditEntry(
          supabase,
          integration_id,
          custom_schedule ? "schedule_update" : "frequency_change",
          previousSchedule,
          cronExpression,
          integrationMetadata?.config ? { ...integrationMetadata.config } : null,
          { sync_schedule: cronExpression, frequency_minutes },
        );
      }
      
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

    // Disabled - audit the removal
    if (integration_id) {
      await insertAuditEntry(
        supabase,
        integration_id,
        "schedule_update",
        previousSchedule,
        null,
        integrationMetadata?.config ? { ...integrationMetadata.config } : null,
        { is_active: false },
      );
    }

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
