import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map sync_frequency_minutes to cron expressions
const frequencyToCron: Record<number, string> = {
  3: "*/3 * * * *",
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
  alka: "4,19,34,49 * * * *",
};

const LOVABLE_ALLOWED_ACTIONS = ["campaigns", "users", "sales", "calls"] as const;
const LOVABLE_META_FIVE_MINUTE_SCHEDULE = "5,35 * * * *";

const isLovableTdcIntegration = (
  integrationName?: string | null,
  config?: Record<string, unknown> | null,
): boolean => {
  const normalizedName = (integrationName || "").trim().toLowerCase();
  if (!normalizedName) return false;

  if (normalizedName.includes("lovablecph") || normalizedName.includes("tdc")) {
    return true;
  }

  const explicit = config?.use_split_sync_jobs;
  return explicit === true;
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

  const normalizedName = (integrationName || "").trim().toLowerCase();

  // Lovable/TDC should always run sales sync every 5 minutes unless explicitly overridden
  if (isLovableTdcIntegration(integrationName, config)) {
    // Lovablecph should always run sales sync every 5 minutes unless explicitly overridden
    if (normalizedName === "lovablecph") {
      return staggeredFiveMinuteSchedules.lovablecph;
    }

    if (frequencyMinutes === 5 && staggeredFiveMinuteSchedules[normalizedName]) {
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

type DialerJobConfig = {
  jobName: string;
  schedule: string;
  payload: Record<string, unknown>;
};

const getActionConfig = (
  config: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string[],
): string[] => {
  const raw = config?.[key];
  if (!Array.isArray(raw)) return fallback;

  const actions = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return actions.length > 0 ? actions : fallback;
};

const toAllowedActions = (actions: string[], allowed: readonly string[]): string[] => {
  const allowedSet = new Set(allowed);
  return actions.filter((action, idx) => allowedSet.has(action) && actions.indexOf(action) === idx);
};

const getNumberConfig = (
  config: Record<string, unknown> | null | undefined,
  key: string,
): number | undefined => {
  const value = config?.[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return undefined;
};

const getMetaSyncSchedule = (
  integrationName?: string | null,
  config?: Record<string, unknown> | null,
): string | null => {
  const configured = config?.meta_sync_schedule;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }

  if (isLovableTdcIntegration(integrationName, config)) {
    return LOVABLE_META_FIVE_MINUTE_SCHEDULE;
  }

  return null;
};

const buildDialerJobs = (
  integrationId: string,
  provider: string,
  integrationName?: string | null,
  config?: Record<string, unknown> | null,
  frequencyMinutes?: number | null,
  primarySchedule?: string | null,
): DialerJobConfig[] => {
  const syncDays = getSyncDays(integrationName, config);

  if (isLovableTdcIntegration(integrationName, config)) {
    const salesMaxRecords = getNumberConfig(config, "sales_max_records") ?? 20;
    const salesSchedule = primarySchedule || frequencyToCron[frequencyMinutes || 5] || "*/5 * * * *";
    const metaSchedule = getMetaSyncSchedule(integrationName, config) || "*/30 * * * *";
    const salesActions = toAllowedActions(getActionConfig(config, "sync_actions", ["sales"]), LOVABLE_ALLOWED_ACTIONS);
    const metaActions = toAllowedActions(
      getActionConfig(config, "meta_sync_actions", ["campaigns", "users", "calls"]),
      LOVABLE_ALLOWED_ACTIONS,
    );

    return [
      {
        jobName: `dialer-${integrationId.slice(0, 8)}-sync-sales`,
        schedule: salesSchedule,
        payload: {
          source: provider,
          integration_id: integrationId,
          actions: salesActions.length > 0 ? salesActions : ["sales"],
          days: syncDays,
          maxRecords: salesMaxRecords,
        },
      },
      {
        jobName: `dialer-${integrationId.slice(0, 8)}-sync-meta`,
        schedule: metaSchedule,
        payload: {
          source: provider,
          integration_id: integrationId,
          actions: metaActions.length > 0 ? metaActions : ["campaigns", "users", "calls"],
          days: syncDays,
        },
      },
    ];
  }

  return [
    {
      jobName: `dialer-${integrationId.slice(0, 8)}-sync`,
      schedule: primarySchedule || frequencyToCron[frequencyMinutes || 5] || "*/5 * * * *",
      payload: {
        source: provider,
        integration_id: integrationId,
        actions: ["campaigns", "users", "sales", "sessions"],
        days: syncDays,
      },
    },
  ];
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
    let dialerJobConfigs: DialerJobConfig[] = [];
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

      const dialerSchedule = getDialerSchedule(integrationMetadata?.name, integrationMetadata?.config, frequency_minutes);
      dialerJobConfigs = buildDialerJobs(
        integration_id,
        provider || "adversus",
        integrationMetadata?.name,
        integrationMetadata?.config,
        frequency_minutes,
        dialerSchedule,
      );

      payload = dialerJobConfigs[0]?.payload || {
        source: provider || "adversus",
        integration_id,
        actions: ["campaigns", "users", "sales", "sessions"],
        days: 1,
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

    // Unschedule existing job(s)
    const jobsToUnschedule = integration_type === "dialer" && integration_id
      ? [
          `dialer-${integration_id.slice(0, 8)}-sync`,
          `dialer-${integration_id.slice(0, 8)}-sync-sales`,
          `dialer-${integration_id.slice(0, 8)}-sync-meta`,
        ]
      : [jobName];

    for (const candidateJobName of jobsToUnschedule) {
      try {
        const { error: unscheduleError } = await supabase.rpc("unschedule_integration_sync", {
          p_job_name: candidateJobName,
        });
        if (unscheduleError) {
          console.log(`Could not unschedule existing job (may not exist): ${candidateJobName} -> ${unscheduleError.message}`);
        } else {
          console.log(`Unscheduled existing job: ${candidateJobName}`);
        }
      } catch (_e) {
        console.log(`No existing job to unschedule: ${candidateJobName}`);
      }
    }

    const dialerSchedule = integration_type === "dialer"
      ? getDialerSchedule(integrationMetadata?.name, integrationMetadata?.config, frequency_minutes)
      : null;

    if (is_active && (custom_schedule || dialerSchedule || (frequency_minutes && frequencyToCron[frequency_minutes]))) {
      const cronExpression = custom_schedule || dialerSchedule || frequencyToCron[frequency_minutes];
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
      const jobsToSchedule = integration_type === "dialer"
        ? dialerJobConfigs.map((job, index) => {
            if (index === 0 && custom_schedule) {
              return { ...job, schedule: custom_schedule };
            }
            return job;
          })
        : [{ jobName, schedule: cronExpression, payload }];

      const scheduledJobs: Array<{ jobName: string; schedule: string; jobId: unknown }> = [];
      for (const jobConfig of jobsToSchedule) {
        console.log(`[update-cron-schedule] Scheduling: ${jobConfig.jobName} @ ${jobConfig.schedule} -> ${functionUrl}`);

        const { data: scheduleData, error: scheduleError } = await supabase.rpc("schedule_integration_sync", {
          p_job_name: jobConfig.jobName,
          p_schedule: jobConfig.schedule,
          p_function_url: functionUrl,
          p_anon_key: anonKey,
          p_payload: jobConfig.payload,
        });

        if (scheduleError) {
          console.error("Error scheduling cron job via RPC:", scheduleError);
          throw new Error(`Failed to schedule cron job ${jobConfig.jobName}: ${scheduleError.message}`);
        }

        scheduledJobs.push({ jobName: jobConfig.jobName, schedule: jobConfig.schedule, jobId: scheduleData });
        console.log(`Scheduled new cron job: ${jobConfig.jobName} with schedule: ${jobConfig.schedule}, jobId: ${scheduleData}`);
      }

      // Persist schedule to integration config
      if (integration_type === "dialer" && integration_id) {
        const currentConfig = integrationMetadata?.config || {};
        const updatedConfig = { ...currentConfig, sync_schedule: cronExpression };
        const { error: updateError } = await supabase
          .from("dialer_integrations")
          .update({
            config: updatedConfig,
            sync_frequency_minutes: frequency_minutes,
          })
          .eq("id", integration_id);
        if (updateError) {
          console.error(`[update-cron-schedule] Failed to persist config: ${updateError.message}`);
        } else {
          console.log(`[update-cron-schedule] Persisted sync_schedule to integration config`);
        }
      }

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
          jobs: scheduledJobs,
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
