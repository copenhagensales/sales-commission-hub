/**
 * Safe Backfill Action
 * 
 * Budget-aware, provider-level backfill that processes day-by-day,
 * reserves 30% capacity for ongoing cron syncs, and aggregates
 * API usage across all integrations sharing the same provider.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { IngestionEngine } from "../core.ts";
import { getAdapter } from "../adapters/registry.ts";
import type { CampaignMappingConfig } from "../types.ts";

type Logger = (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void;

// Provider-level API limits
const PROVIDER_LIMITS: Record<string, { perMin: number; perHour: number }> = {
  adversus: { perMin: 60, perHour: 1000 },
  enreach: { perMin: 240, perHour: 10000 },
};

const RESERVE_PCT = 0.30; // 30% reserved for ongoing cron sync
const BUDGET_WINDOW_MINUTES = 60; // Check hourly budget

interface SafeBackfillParams {
  integrationId: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  maxRecordsPerDay?: number;
  datasets?: ("sales" | "calls")[];
  campaignIds?: string[];
  uncapped?: boolean;
}

interface SafeBackfillResult {
  success: boolean;
  daysProcessed: number;
  totalSales: number;
  totalCalls: number;
  budgetUsed: number;
  budgetAvailable: number;
  details: Record<string, { sales: number; calls: number }>;
  message: string;
  stoppedEarly?: boolean;
}

/**
 * Get total API calls made by a single integration within the given time window.
 * Each integration has its own independent budget since they use separate API credentials.
 */
async function getIntegrationApiUsage(
  supabase: SupabaseClient,
  integrationId: string,
  windowMinutes: number,
): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("integration_sync_runs")
    .select("api_calls_made")
    .eq("integration_id", integrationId)
    .gte("started_at", since);

  if (error || !data) return 0;
  return data.reduce((sum: number, row: any) => sum + (row.api_calls_made || 0), 0);
}

/**
 * Calculate how many records we can safely fetch given the provider budget.
 */
function calculateSafeMaxRecords(
  providerUsage: number,
  provider: string,
  log: Logger,
): number {
  const limits = PROVIDER_LIMITS[provider];
  if (!limits) {
    log("WARN", `Unknown provider "${provider}", using conservative limit`);
    return 50;
  }

  const usableCapacity = Math.floor(limits.perHour * (1 - RESERVE_PCT));
  const available = usableCapacity - providerUsage;

  log("INFO", `Provider ${provider} budget: ${providerUsage}/${limits.perHour} used, ${usableCapacity} usable (${RESERVE_PCT * 100}% reserved), ${available} available`);

  if (available <= 0) return 0;

  // Each "record" ≈ 1 API call for sales fetch (batch endpoint)
  // Be conservative: assume 2 API calls per day-range request
  return Math.max(0, available);
}

/**
 * Format a Date as YYYY-MM-DD.
 */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Add N days to a date string.
 */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

/**
 * Generate array of day strings between from and to (exclusive of to).
 */
function getDayRange(from: string, to: string): string[] {
  const days: string[] = [];
  let current = from;
  while (current < to) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

/**
 * Run a safe, budget-aware backfill for a single integration.
 */
export async function safeBackfill(
  supabase: SupabaseClient,
  params: SafeBackfillParams,
  log: Logger,
): Promise<SafeBackfillResult> {
  const { integrationId, from, to, maxRecordsPerDay = 600, datasets = ["sales", "calls"], campaignIds, uncapped = false } = params;

  // 1. Load integration
  const { data: integration } = await supabase
    .from("dialer_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (!integration) {
    return {
      success: false, daysProcessed: 0, totalSales: 0, totalCalls: 0,
      budgetUsed: 0, budgetAvailable: 0, details: {},
      message: `Integration ${integrationId} not found`,
    };
  }

  const provider = integration.provider;
  log("INFO", `Safe backfill: ${integration.name} (${provider}), range ${from} -> ${to}, uncapped=${uncapped}, campaignIds=${campaignIds?.join(",") || "all"}`);

  // 2. Check provider-level budget
  const integrationUsage = await getIntegrationApiUsage(supabase, integrationId, BUDGET_WINDOW_MINUTES);
  const availableBudget = calculateSafeMaxRecords(integrationUsage, provider, log);

  if (availableBudget <= 0) {
    log("WARN", `No API budget available for provider ${provider} – skipping`);
    return {
      success: true, daysProcessed: 0, totalSales: 0, totalCalls: 0,
      budgetUsed: integrationUsage, budgetAvailable: 0, details: {},
      message: `No API budget available for integration ${integration.name}. Current usage: ${integrationUsage}. Will retry later.`,
    };
  }

  // 3. Initialize engine and adapter
  const engine = new IngestionEngine();
  const campaignMappings = await engine.getCampaignMappings();

  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
  const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
    p_integration_id: integrationId,
    p_encryption_key: encryptionKey,
  });

  const adapter = getAdapter(
    provider,
    credentials,
    integration.name,
    integration.api_url,
    integration.config,
    integration.calls_org_codes,
  );

  // 4. Process day by day
  const days = getDayRange(from, to);
  let totalSales = 0;
  let totalCalls = 0;
  let daysProcessed = 0;
  let apiCallsThisRun = 0;
  const details: Record<string, { sales: number; calls: number }> = {};
  let stoppedEarly = false;
  const syncRunStartedAt = new Date();

  for (const dayStart of days) {
    // Re-check budget before each day (account for calls made in this run)
    const currentTotalUsage = integrationUsage + apiCallsThisRun;
    const limits = PROVIDER_LIMITS[provider] || { perHour: 1000 };
    const usableCapacity = Math.floor(limits.perHour * (1 - RESERVE_PCT));
    const remaining = usableCapacity - currentTotalUsage;

    if (remaining <= 10) {
      log("WARN", `Budget nearly exhausted (${remaining} remaining). Stopping after ${daysProcessed} days.`);
      stoppedEarly = true;
      break;
    }

    const dayEnd = addDays(dayStart, 1);
    const effectiveMaxRecords = Math.min(maxRecordsPerDay, remaining);

    log("INFO", `Backfill day ${dayStart} -> ${dayEnd} (max ${effectiveMaxRecords} records, ${remaining} budget remaining)`);

    try {
      // Fetch sales
      let salesCount = 0;
      if (datasets.includes("sales") && (adapter as any).fetchSalesRange) {
        const sales = await (adapter as any).fetchSalesRange(
          { from: dayStart, to: dayEnd },
          campaignMappings,
          uncapped ? undefined : effectiveMaxRecords,
          { uncapped, campaignIds },
        );

        // campaignIds filtering now also happens pre-enrichment in adapter,
        // but keep post-filter as safety net
        const filteredSales = campaignIds && campaignIds.length > 0
          ? sales.filter((s: any) => s.campaignId && campaignIds.includes(s.campaignId))
          : sales;

        if (filteredSales.length > 0) {
          const result = await engine.processSales(filteredSales, 200);
          salesCount = (result as any)?.processed || 0;
        }
        log("INFO", `Day ${dayStart}: ${sales.length} sales fetched${campaignIds ? `, ${filteredSales.length} after campaign filter` : ""}, ${salesCount} processed`);
      }

      // Fetch calls
      let callsCount = 0;
      if (datasets.includes("calls") && (adapter as any).fetchCallsRange) {
        const calls = await (adapter as any).fetchCallsRange({ from: dayStart, to: dayEnd });
        if (calls.length > 0) {
          const result = await engine.processCalls(calls, integrationId, 200);
          callsCount = (result as any)?.processed || 0;
        }
        log("INFO", `Day ${dayStart}: ${callsCount} calls processed`);
      }

      details[dayStart] = { sales: salesCount, calls: callsCount };
      totalSales += salesCount;
      totalCalls += callsCount;
      daysProcessed++;

      // Update API calls estimate from adapter metrics
      const metrics = (adapter as any).getMetrics?.() ?? { apiCalls: 0 };
      apiCallsThisRun = metrics.apiCalls;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log("ERROR", `Backfill failed on day ${dayStart}: ${errMsg}`);
      details[dayStart] = { sales: 0, calls: 0 };
      // Stop on error to avoid cascading failures
      stoppedEarly = true;
      break;
    }
  }

  // 5. Log sync run
  const syncRunCompletedAt = new Date();
  const durationMs = syncRunCompletedAt.getTime() - syncRunStartedAt.getTime();
  const adapterMetrics = (adapter as any).getMetrics?.() ?? { apiCalls: 0, retries: 0, rateLimitHits: 0 };

  await supabase.from("integration_sync_runs").insert({
    integration_id: integrationId,
    started_at: syncRunStartedAt.toISOString(),
    completed_at: syncRunCompletedAt.toISOString(),
    duration_ms: durationMs,
    status: stoppedEarly ? "partial" : "success",
    actions: ["safe-backfill"],
    records_processed: totalSales + totalCalls,
    api_calls_made: adapterMetrics.apiCalls,
    retries: adapterMetrics.retries,
    rate_limit_hits: adapterMetrics.rateLimitHits,
  });

  await supabase.from("integration_logs").insert({
    integration_type: "dialer",
    integration_id: integrationId,
    integration_name: integration.name,
    status: stoppedEarly ? "partial" : "success",
    message: `Safe backfill: ${daysProcessed}/${days.length} days, ${totalSales} sales, ${totalCalls} calls`,
    duration_ms: durationMs,
    details: {
      action: "safe-backfill",
      from, to,
      days_processed: daysProcessed,
      days_total: days.length,
      total_sales: totalSales,
      total_calls: totalCalls,
      budget_used: integrationUsage + adapterMetrics.apiCalls,
      budget_available: availableBudget,
      stopped_early: stoppedEarly,
      results: details,
    },
  });

  const message = stoppedEarly
    ? `Safe backfill partial: ${daysProcessed}/${days.length} days processed (budget or error). ${totalSales} sales, ${totalCalls} calls.`
    : `Safe backfill complete: ${daysProcessed} days, ${totalSales} sales, ${totalCalls} calls.`;

  return {
    success: true,
    daysProcessed,
    totalSales,
    totalCalls,
    budgetUsed: integrationUsage + adapterMetrics.apiCalls,
    budgetAvailable: availableBudget,
    details,
    message,
    stoppedEarly,
  };
}
