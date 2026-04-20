/**
 * Smart Backfill Action
 * 
 * Incrementally fetches historical data day-by-day from a configurable start date
 * up to today. Checks API budget before each run, reserves capacity for standard
 * sync, and stops automatically when cursor reaches current date.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { IngestionEngine } from "../core.ts";
import { getAdapter } from "../adapters/registry.ts";
import { getSyncState, upsertSyncState } from "../utils/index.ts";
import { CampaignMappingConfig } from "../types.ts";

const DEFAULT_START_DATE = "2026-01-15";
const RESERVED_FOR_STANDARD_SYNC = 15;
const API_CALLS_PER_DAY = 8; // ~4 sales + ~4 calls per day-range
const MAX_RATE_PER_MINUTE = 60;
const BUDGET_WINDOW_MINUTES = 10;

type Logger = (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void;

interface BackfillResult {
  success: boolean;
  daysProcessed: number;
  cursor: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Calculate how many API calls have been used recently by this integration.
 */
async function getRecentApiUsage(
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
 * Calculate how many days we can safely fetch given current API budget.
 */
function calculateBudget(recentCalls: number, windowMinutes: number): number {
  const callsPerMinute = recentCalls / windowMinutes;
  const available = MAX_RATE_PER_MINUTE - callsPerMinute - RESERVED_FOR_STANDARD_SYNC;
  
  if (available <= 0) return 0;

  // We have `available` calls/min and the backfill runs once, so use a conservative
  // chunk: assume we can use ~50% of the remaining per-minute budget over 5 minutes.
  const totalBudget = Math.floor(available * 5);
  const days = Math.max(0, Math.floor(totalBudget / API_CALLS_PER_DAY));
  
  // Cap at 7 days per run to keep execution time reasonable
  return Math.min(days, 7);
}

/**
 * Format a Date as YYYY-MM-DD.
 */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Add N days to a date string and return new Date.
 */
function addDays(dateStr: string, n: number): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/**
 * Run the smart backfill for a single integration.
 */
export async function smartBackfill(
  supabase: SupabaseClient,
  integrationId: string,
  log: Logger,
): Promise<BackfillResult> {
  // 1. Read cursor from sync state
  const syncState = await getSyncState(supabase, integrationId, "backfill");
  
  // Get backfill start date from integration config
  const { data: integration } = await supabase
    .from("dialer_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (!integration) {
    return { success: false, daysProcessed: 0, cursor: "", message: "Integration not found" };
  }

  const startDate = (integration.config as any)?.backfill_start_date || DEFAULT_START_DATE;
  const cursor = syncState?.cursor || startDate;

  // 2. Check if backfill is complete (cursor >= today)
  const today = toDateStr(new Date());
  if (cursor >= today) {
    log("INFO", `Backfill complete: cursor ${cursor} >= today ${today}`);
    return {
      success: true,
      daysProcessed: 0,
      cursor,
      message: "Backfill complete – all data up to today has been fetched",
    };
  }

  // 3. Calculate API budget
  const recentUsage = await getRecentApiUsage(supabase, integrationId, BUDGET_WINDOW_MINUTES);
  const daysToFetch = calculateBudget(recentUsage, BUDGET_WINDOW_MINUTES);

  log("INFO", `Backfill budget: ${recentUsage} API calls in last ${BUDGET_WINDOW_MINUTES}min, can fetch ${daysToFetch} days`);

  if (daysToFetch === 0) {
    log("WARN", "No API budget available for backfill – skipping this run");
    return {
      success: true,
      daysProcessed: 0,
      cursor,
      message: "No API budget available – will retry next hour",
    };
  }

  // 4. Initialize engine and adapter
  const engine = new IngestionEngine();
  const campaignMappings = await engine.getCampaignMappings();

  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
  const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
    p_integration_id: integrationId,
    p_encryption_key: encryptionKey,
  });

  const adapter = await getAdapter(
    integration.provider,
    credentials,
    integration.name,
    integration.api_url,
    integration.config,
    integration.calls_org_codes,
  );

  // 5. Process day by day
  let currentCursor = cursor;
  let totalDaysProcessed = 0;
  const allResults: Record<string, unknown> = {};
  const syncRunStartedAt = new Date();

  for (let i = 0; i < daysToFetch; i++) {
    const dayStart = currentCursor;
    const dayEndDate = addDays(dayStart, 1);
    const dayEnd = toDateStr(dayEndDate);

    // Don't go past today
    if (dayStart >= today) break;
    const effectiveEnd = dayEnd > today ? today : dayEnd;

    log("INFO", `Backfill day ${i + 1}/${daysToFetch}: ${dayStart} -> ${effectiveEnd}`);

    try {
      // Fetch sales for this day
      let salesCount = 0;
      if ((adapter as any).fetchSalesRange) {
        const sales = await (adapter as any).fetchSalesRange(
          { from: dayStart, to: effectiveEnd },
          campaignMappings,
        );
        if (sales.length > 0) {
          const result = await engine.processSales(sales, 200);
          salesCount = (result as any)?.processed || 0;
        }
      }

      // Fetch calls for this day
      let callsCount = 0;
      if ((adapter as any).fetchCallsRange) {
        const calls = await (adapter as any).fetchCallsRange({ from: dayStart, to: effectiveEnd });
        if (calls.length > 0) {
          const result = await engine.processCalls(calls, integrationId, 200);
          callsCount = (result as any)?.processed || 0;
        }
      }

      log("INFO", `Backfill day ${dayStart}: ${salesCount} sales, ${callsCount} calls`);
      allResults[dayStart] = { sales: salesCount, calls: callsCount };

      // Update cursor to next day
      currentCursor = effectiveEnd;
      totalDaysProcessed++;

      // Persist cursor after each successful day
      await upsertSyncState(supabase, integrationId, "backfill", new Date(), currentCursor);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log("ERROR", `Backfill failed on day ${dayStart}: ${errMsg}`);
      // Stop processing further days on error, but keep progress so far
      break;
    }
  }

  // 6. Log sync run
  const syncRunCompletedAt = new Date();
  const durationMs = syncRunCompletedAt.getTime() - syncRunStartedAt.getTime();
  const adapterMetrics = (adapter as any).getMetrics?.() ?? { apiCalls: 0, retries: 0, rateLimitHits: 0 };

  await supabase.from("integration_sync_runs").insert({
    integration_id: integrationId,
    started_at: syncRunStartedAt.toISOString(),
    completed_at: syncRunCompletedAt.toISOString(),
    duration_ms: durationMs,
    status: "success",
    actions: ["backfill"],
    records_processed: totalDaysProcessed,
    api_calls_made: adapterMetrics.apiCalls,
    retries: adapterMetrics.retries,
    rate_limit_hits: adapterMetrics.rateLimitHits,
  });

  await supabase.from("integration_logs").insert({
    integration_type: "dialer",
    integration_id: integrationId,
    integration_name: integration.name,
    status: "success",
    message: `Backfill: ${totalDaysProcessed} days processed (${currentCursor})`,
    duration_ms: durationMs,
    details: {
      action: "backfill",
      cursor_from: cursor,
      cursor_to: currentCursor,
      days_processed: totalDaysProcessed,
      results: allResults,
    },
  });

  const isComplete = currentCursor >= today;
  return {
    success: true,
    daysProcessed: totalDaysProcessed,
    cursor: currentCursor,
    message: isComplete
      ? "Backfill complete – all data up to today has been fetched"
      : `Backfill progress: cursor at ${currentCursor}, ${totalDaysProcessed} days processed`,
    details: allResults,
  };
}
