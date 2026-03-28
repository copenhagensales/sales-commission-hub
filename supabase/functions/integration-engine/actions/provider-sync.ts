import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { IngestionEngine } from "../core.ts";
import { syncIntegration } from "./sync-integration.ts";
import { CampaignMappingConfig } from "../types.ts";
import { checkProviderQuota } from "../utils/quota-gate.ts";
import type { LogFn } from "../utils/index.ts";

/**
 * Provider-level budget limits (calls per hour)
 */
const PROVIDER_BUDGETS: Record<string, { limit: number; threshold: number }> = {
  adversus: { limit: 1000, threshold: 0.70 },  // Stop at 70%
  enreach: { limit: 10000, threshold: 0.80 },   // Stop at 80%
};

/**
 * Default sync actions per provider
 */
const PROVIDER_DEFAULTS: Record<string, { actions: string[]; maxRecords: number; days: number }> = {
  adversus: { actions: ["campaigns", "users", "sales", "calls"], maxRecords: 150, days: 2 },
  enreach: { actions: ["campaigns", "users", "sales", "sessions"], maxRecords: 200, days: 3 },
};

/**
 * Acquire a provider-level lock. Returns true if lock acquired.
 */
async function acquireLock(supabase: SupabaseClient, provider: string, log: LogFn): Promise<boolean> {
  // First, clean up expired locks
  await supabase
    .from("provider_sync_locks")
    .delete()
    .lt("expires_at", new Date().toISOString());

  // Try to insert lock
  const { error } = await supabase
    .from("provider_sync_locks")
    .insert({
      provider,
      locked_at: new Date().toISOString(),
      locked_by: `provider-sync-${provider}`,
      expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    });

  if (error) {
    // Check if it's a conflict (lock exists)
    if (error.code === "23505") {
      log("WARN", `Provider ${provider} is already locked, skipping this run`);
      return false;
    }
    log("ERROR", `Failed to acquire lock for ${provider}: ${error.message}`);
    return false;
  }

  log("INFO", `Acquired lock for provider ${provider}`);
  return true;
}

/**
 * Release the provider lock
 */
async function releaseLock(supabase: SupabaseClient, provider: string, log: LogFn): Promise<void> {
  const { error } = await supabase
    .from("provider_sync_locks")
    .delete()
    .eq("provider", provider);

  if (error) {
    log("WARN", `Failed to release lock for ${provider}: ${error.message}`);
  } else {
    log("INFO", `Released lock for provider ${provider}`);
  }
}

/**
 * Calculate current API budget usage across ALL integrations for a provider (last 60 minutes).
 * Enreach integrations share a single account-level daily quota, so we must
 * aggregate api_calls_made across Eesy, Tryg, ASE etc. to correctly gate syncs.
 */
async function getProviderBudgetUsage(supabase: SupabaseClient, provider: string, log: LogFn): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Get all active integration IDs for this provider
  const { data: integrations } = await supabase
    .from("dialer_integrations")
    .select("id, name")
    .eq("provider", provider)
    .eq("is_active", true);

  if (!integrations || integrations.length === 0) return 0;

  const integrationIds = integrations.map((i: any) => i.id);

  // Sum api_calls_made across ALL integrations for this provider
  const { data: runs } = await supabase
    .from("integration_sync_runs")
    .select("api_calls_made, integration_id")
    .in("integration_id", integrationIds)
    .gte("started_at", oneHourAgo);

  const totalCalls = (runs || []).reduce((sum: number, r: any) => sum + (r.api_calls_made || 0), 0);
  const breakdown = integrations.map((i: any) => {
    const calls = (runs || []).filter((r: any) => r.integration_id === i.id).reduce((s: number, r: any) => s + (r.api_calls_made || 0), 0);
    return `${i.name}:${calls}`;
  }).join(", ");
  log("INFO", `Provider ${provider} shared budget usage: ${totalCalls} calls in last 60 min (${breakdown})`);
  return totalCalls;
}

/**
 * Check if current time is within Danish working hours (08:00-21:00 Europe/Copenhagen)
 */
function isDanishWorkingHours(): boolean {
  const now = new Date();
  const dkHour = parseInt(
    now.toLocaleString('en-US', { 
      hour: 'numeric', hour12: false, timeZone: 'Europe/Copenhagen' 
    })
  );
  return dkHour >= 8 && dkHour < 21;
}

/**
 * Provider-sync orchestrator
 * Runs all active integrations for a provider sequentially with budget gates
 */
export async function providerSync(
  supabase: SupabaseClient,
  provider: string,
  log: LogFn
): Promise<{ success: boolean; results: any[]; budgetUsed: number; skipped: string[] }> {
  const budget = PROVIDER_BUDGETS[provider] || { limit: 1000, threshold: 0.70 };
  const defaults = PROVIDER_DEFAULTS[provider] || { actions: ["campaigns", "users", "sales"], maxRecords: 200, days: 2 };

  // Skip entire provider sync outside Danish working hours (21:00-08:00)
  if ((provider === "enreach" || provider === "adversus") && !isDanishWorkingHours()) {
    log("INFO", `Provider-sync skipped for ${provider}: outside Danish working hours (21:00-08:00 DK)`);
    return { success: true, results: [], budgetUsed: 0, skipped: ["outside_working_hours"] };
  }

  // 1. Global quota gate – skip entire provider if quota exhausted
  const quotaStatus = await checkProviderQuota(supabase, provider);
  if (quotaStatus.exhausted) {
    log("WARN", `Provider-sync quota gate: ${provider} quota exhausted (remaining=${quotaStatus.remaining}, reset=${quotaStatus.resetAt}). Skipping entire provider.`);
    return { success: true, results: [], budgetUsed: 0, skipped: ["quota_exhausted"] };
  }

  // 2. Acquire lock
  const locked = await acquireLock(supabase, provider, log);
  if (!locked) {
    return { success: false, results: [], budgetUsed: 0, skipped: [`lock_held`] };
  }

  try {
    // 2. Get all active integrations for this provider
    const { data: integrations, error } = await supabase
      .from("dialer_integrations")
      .select("*")
      .eq("provider", provider)
      .eq("is_active", true)
      .order("last_sync_at", { ascending: true, nullsFirst: true });

    if (error) throw error;
    if (!integrations || integrations.length === 0) {
      log("INFO", `No active integrations for provider ${provider}`);
      return { success: true, results: [], budgetUsed: 0, skipped: [] };
    }

    log("INFO", `Provider-sync: ${integrations.length} active ${provider} integration(s)`);

    // 3. Initialize engine and fetch campaign mappings
    const engine = new IngestionEngine();
    const campaignMappings = await engine.getCampaignMappings();

    // 4. Process integrations sequentially with budget checks
    const results: any[] = [];
    const skipped: string[] = [];
    let totalBudgetUsed = 0;

    for (const integration of integrations) {
      // Budget gate: check shared provider-level usage (Enreach shares a single account quota)
      const providerUsage = await getProviderBudgetUsage(supabase, provider, log);
      const budgetThreshold = budget.limit * budget.threshold;
      if (providerUsage >= budgetThreshold) {
        log("WARN", `Provider ${provider} shared budget threshold reached (${providerUsage}/${budget.limit} @ ${budget.threshold * 100}%), skipping ${integration.name}`);
        skipped.push(integration.name);
        continue;
      }

      log("INFO", `Syncing ${integration.name} (shared provider budget: ${providerUsage}/${budget.limit})`);

      const result = await syncIntegration(supabase, integration, engine, campaignMappings, {
        source: provider,
        actions: defaults.actions,
        days: defaults.days,
        maxRecords: defaults.maxRecords,
      }, log);

      results.push(result);
    }

    // Get final total for return value
    totalBudgetUsed = await getProviderBudgetUsage(supabase, provider, log);

    return { success: true, results, budgetUsed: totalBudgetUsed, skipped };
  } finally {
    // 5. Always release lock
    await releaseLock(supabase, provider, log);
  }
}
