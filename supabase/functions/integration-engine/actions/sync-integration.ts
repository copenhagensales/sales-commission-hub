import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { IngestionEngine } from "../core.ts";
import { getAdapter } from "../adapters/registry.ts";
import { saveDebugLog, createDebugLogEntry } from "../utils/debug-log.ts";
import { recordSyncError } from "../utils/sync-state.ts";
import { checkCircuitBreaker, recordCircuitBreakerFailure, resetCircuitBreaker } from "../utils/circuit-breaker.ts";
import { checkProviderQuota } from "../utils/quota-gate.ts";
import { TimeoutGuard } from "../utils/timeout-guard.ts";
import { enqueueFailed } from "../utils/dlq.ts";
import { acquireRunLock, releaseRunLock, generateRunId } from "../utils/run-lock.ts";
import { CampaignMappingConfig } from "../types.ts";

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

interface SyncOptions {
  source?: string;
  action?: string;
  actions?: string[];
  days?: number;
  campaignId?: string;
  integrationId?: string;
  from?: string;
  to?: string;
  maxRecords?: number;
}

const LOVABLE_ACTIONS = ["campaigns", "users", "sales", "calls"] as const;

const normalizeActions = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const unique = (items: string[]): string[] => items.filter((item, idx) => items.indexOf(item) === idx);

const isLovableTdcIntegration = (integration: any): boolean => {
  const integrationName = String(integration?.name || "").trim().toLowerCase();
  if (!integrationName) return false;

  if (integrationName.includes("lovablecph") || integrationName.includes("tdc")) {
    return true;
  }

  return integration?.config?.use_split_sync_jobs === true;
};

const getEffectiveActionList = (
  integration: any,
  actions: string[] | undefined,
  action: string | undefined,
): string[] => {
  const requested = unique((actions || (action === "sync" ? ["campaigns", "users", "sales", "sessions"] : [action]))
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean));

  if (!isLovableTdcIntegration(integration)) return requested;
  const integrationName = String(integration?.name || "").trim().toLowerCase();
  if (integrationName !== "lovablecph") return requested;

  const config = (integration?.config || {}) as Record<string, unknown>;
  const cfgSync = normalizeActions(config.sync_actions);
  const cfgMeta = normalizeActions(config.meta_sync_actions);
  const allowed = new Set<string>(LOVABLE_ACTIONS);

  // Exclude "sessions" for Lovablecph – Adversus returns HTTP 403 for this endpoint
  const excludedActions = new Set<string>(normalizeActions(config.excluded_actions ?? ["sessions"]));

  const merged = unique([...requested, ...cfgSync, ...cfgMeta])
    .filter((item) => allowed.has(item) && !excludedActions.has(item));
  return merged.length > 0 ? merged : [...LOVABLE_ACTIONS].filter((a) => !excludedActions.has(a));
};

interface SyncResult {
  name: string;
  status: "success" | "error" | "partial_success" | "skipped_locked";
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Process a single integration sync with per-integration run lock
 */
export async function syncIntegration(
  supabase: SupabaseClient,
  integration: any,
  engine: IngestionEngine,
  campaignMappings: CampaignMappingConfig[],
  options: SyncOptions,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
): Promise<SyncResult> {
  const { source, action, actions, days = 3, campaignId, from, to, maxRecords = 50 } = options;
  const actionList = getEffectiveActionList(integration, actions, action);
  const syncRunStartedAt = new Date();
  const runId = generateRunId();
  let adapter: any = null;

  // === Skip outside Danish working hours (21:00-08:00) for both Enreach and Adversus ===
  const provider = (source || integration.provider || "").toLowerCase();
  if ((provider === "enreach" || provider === "adversus") && !isDanishWorkingHours()) {
    log("INFO", `Skipping ${integration.name}: outside Danish working hours (21:00-08:00 DK)`);
    await supabase.from("integration_sync_runs").insert({
      integration_id: integration.id,
      started_at: syncRunStartedAt.toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 0,
      status: "skipped",
      actions: actionList,
      records_processed: 0,
      api_calls_made: 0,
      retries: 0,
      rate_limit_hits: 0,
      run_id: runId,
      error_message: "Skipped: outside working hours (21:00-08:00 DK)",
    });
    return { name: integration.name, status: "skipped_locked" as any, error: "Outside working hours (21:00-08:00 DK)" };
  }

  // === Per-Integration Run Lock ===
  const lockAcquired = await acquireRunLock(supabase, integration.id, runId, log);
  if (!lockAcquired) {
    // Record as skipped_locked – NOT an error
    const now = new Date();
    await supabase.from("integration_sync_runs").insert({
      integration_id: integration.id,
      started_at: syncRunStartedAt.toISOString(),
      completed_at: now.toISOString(),
      duration_ms: now.getTime() - syncRunStartedAt.getTime(),
      status: "skipped_locked",
      actions: actionList,
      records_processed: 0,
      api_calls_made: 0,
      retries: 0,
      rate_limit_hits: 0,
      run_id: runId,
      error_message: "Skipped: another sync run is already in progress",
    });
    return { name: integration.name, status: "skipped_locked", error: "Another sync run already in progress" };
  }

  // Initialize timeout guard (150s budget, stop at 80%)
  const timer = new TimeoutGuard(150_000, 0.80);

  try {
    // === Global Provider Quota Gate ===
    const quotaStatus = await checkProviderQuota(supabase, provider);
    if (quotaStatus.exhausted) {
      log("WARN", `Quota gate: ${provider} quota exhausted (remaining=${quotaStatus.remaining}, reset=${quotaStatus.resetAt}). Skipping ${integration.name}.`);
      const now = new Date();
      await supabase.from("integration_sync_runs").insert({
        integration_id: integration.id,
        started_at: syncRunStartedAt.toISOString(),
        completed_at: now.toISOString(),
        duration_ms: now.getTime() - syncRunStartedAt.getTime(),
        status: "skipped",
        actions: actionList,
        records_processed: 0,
        api_calls_made: 0,
        retries: 0,
        rate_limit_hits: 0,
        run_id: runId,
        error_message: `Quota exhausted (remaining=0, reset=${quotaStatus.resetAt || "unknown"})`,
      });
      return { name: integration.name, status: "skipped_locked" as any, error: `Quota exhausted until ${quotaStatus.resetAt || "unknown"}` };
    }

    // === Circuit Breaker Check ===
    const cbState = await checkCircuitBreaker(supabase, integration.id);
    if (cbState.paused) {
      log("WARN", `Circuit breaker: ${integration.name} paused until ${cbState.pausedUntil} (${cbState.consecutiveFailures} consecutive failures). Skipping.`);
      return {
        name: integration.name,
        status: "error",
        error: `Circuit breaker active: paused until ${cbState.pausedUntil}`,
      };
    }

    log("INFO", `Processing integration: ${integration.name} (run_id=${runId}, actions=[${actionList.join(",")}])`);

    // Get decrypted credentials
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
    const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration.id,
      p_encryption_key: encryptionKey,
    });

    adapter = await getAdapter(
      source || integration.provider,
      credentials,
      integration.name,
      integration.api_url,
      integration.config,
      integration.calls_org_codes
    );

    const runResults: Record<string, unknown> = {};
    const actionsExecuted: string[] = [];
    const actionsSkipped: string[] = [];
    let metaSyncRateLimited = false;

    // Process campaigns
    if (actionList.includes("campaigns")) {
      try {
        const campaigns = await adapter.fetchCampaigns();
        runResults["campaigns"] = await engine.processCampaigns(campaigns);
        actionsExecuted.push("campaigns");
      } catch (e) {
        log("WARN", `Campaign sync failed for ${integration.name}: ${(e as Error).message}`);
      }
    }

    // Process users
    if (actionList.includes("users")) {
      try {
        const users = await adapter.fetchUsers();
        const dialerSource = (source || integration.provider) === "enreach" ? "enreach" : "adversus";
        runResults["users"] = await engine.processUsers(users, dialerSource);
        actionsExecuted.push("users");
      } catch (e) {
        log("WARN", `User sync failed for ${integration.name}: ${(e as Error).message}`);
      }
    }

    // Check rate-limit status after meta sync – Enreach-specific targeted abort
    const providerForRateCheck = (source || integration.provider || "").toLowerCase();
    if (providerForRateCheck === "enreach") {
      const earlyMetrics = adapter.getMetrics();
      if (earlyMetrics.rateLimitHits > 0 && earlyMetrics.rateLimitHits >= earlyMetrics.apiCalls * 0.5) {
        metaSyncRateLimited = true;
        log("WARN", `Enreach rate limited during meta sync for ${integration.name} (${earlyMetrics.rateLimitHits}/${earlyMetrics.apiCalls} calls). Skipping heavy actions, marking as partial_success.`, {
          provider: providerForRateCheck,
          integration: integration.name,
          reason: "rate_limited_meta_abort",
          actionsSkipped: actionList.filter(a => !actionsExecuted.includes(a)),
        });
        // Reset metrics so any remaining actions get clean budget
        adapter.resetMetrics();
      } else if (earlyMetrics.rateLimitHits > 0) {
        log("INFO", `Enreach transient rate limits during meta sync for ${integration.name} (${earlyMetrics.rateLimitHits} hits) – retries recovered, continuing`);
      }
    }
    // Adversus: log but do NOT abort – Adversus has higher rate limits
    if (providerForRateCheck === "adversus") {
      const earlyMetrics = adapter.getMetrics();
      if (earlyMetrics.rateLimitHits > 0) {
        log("INFO", `Adversus transient rate limits for ${integration.name} (${earlyMetrics.rateLimitHits} hits) – continuing without abort`);
      }
    }

    // Process sales (skip if Enreach rate-limited during meta, or timeout approaching)
    if ((actionList.includes("sales") || action === "sync") && !metaSyncRateLimited && !timer.isExpired()) {
      const useExplicitRange = from && to;
      let sales: any[] = [];
      let salesWindowEnd: Date | null = null;
      
      if (useExplicitRange && (adapter as any).fetchSalesRange) {
        log("INFO", `Fetching sales by explicit range ${from} -> ${to}`);
        sales = await (adapter as any).fetchSalesRange({ from, to }, campaignMappings, maxRecords);
      } else if ((adapter as any).fetchSalesRange) {
        const salesSyncState = await getSyncState(supabase, integration.id, "sales");
        const windowStart = salesSyncState?.last_success_at
          ? new Date(new Date(salesSyncState.last_success_at).getTime() - 5 * 60 * 1000)
          : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        salesWindowEnd = new Date(Date.now() - 2 * 60 * 1000);

        log("INFO", `Incremental sales sync: ${windowStart.toISOString()} -> ${salesWindowEnd.toISOString()}`);
        sales = await (adapter as any).fetchSalesRange(
          { from: windowStart.toISOString(), to: salesWindowEnd.toISOString() },
          campaignMappings,
          maxRecords
        );
      } else {
        sales = await adapter.fetchSales(days, campaignMappings, maxRecords);
      }
      
      if (campaignId) {
        log("INFO", `Filtering sales for campaign: ${campaignId}`);
        const beforeCount = sales.length;
        sales = sales.filter((s: any) => s.campaignId === String(campaignId));
        log("INFO", `Filtered ${beforeCount} -> ${sales.length} sales for campaign ${campaignId}`);
      }

      sales.sort((a, b) => {
        const dateA = new Date(a.saleDate || a.date || 0).getTime();
        const dateB = new Date(b.saleDate || b.date || 0).getTime();
        return dateB - dateA;
      });

      if (maxRecords && sales.length > maxRecords) {
        log("INFO", `Limiting sales from ${sales.length} to ${maxRecords} (keeping newest)`);
        sales = sales.slice(0, maxRecords);
      }

      try {
        runResults["sales"] = await engine.processSales(sales, 200);
        actionsExecuted.push("sales");
      } catch (salesErr) {
        const salesErrMsg = salesErr instanceof Error ? salesErr.message : String(salesErr);
        log("ERROR", `Sales upsert failed for ${integration.name}: ${salesErrMsg}`);
        // DLQ: save failed records for later reprocessing
        await enqueueFailed(supabase, integration.id, "sales", sales, salesErrMsg, runId);
        runResults["sales"] = { processed: 0, errors: sales.length, message: `Failed: ${salesErrMsg} (${sales.length} records queued in DLQ)` };
      }

      const debugData = (adapter as any).getLastDebugData?.();
      if (debugData) {
        log("INFO", `Saving debug log for ${integration.name}...`);
        const debugEntry = createDebugLogEntry(
          integration.name,
          "sales",
          debugData.rawLeads,
          debugData.processedSales,
          debugData.skipReasonMap
        );
        await saveDebugLog(supabase, debugEntry);
      }

      if (salesWindowEnd) {
        await upsertSyncState(supabase, integration.id, "sales", salesWindowEnd);
      }
    } else if (metaSyncRateLimited && actionList.includes("sales")) {
      actionsSkipped.push("sales");
      runResults["sales"] = { processed: 0, errors: 0, message: "Skipped: rate_limited_meta_abort" };
    }

    // Process calls (skip if timeout approaching)
    if (actionList.includes("calls") && !metaSyncRateLimited && !timer.isExpired()) {
      try {
        let calls: any[] = [];

        // Watermark-based incremental sync (same pattern as sessions)
        const callsSyncState = await getSyncState(supabase, integration.id, "calls");
        let callsWindowStart = callsSyncState?.last_success_at
          ? new Date(new Date(callsSyncState.last_success_at).getTime() - 5 * 60 * 1000)
          : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        let callsWindowEnd = new Date(Date.now() - 2 * 60 * 1000);

        // Explicit from/to from request overrides watermark
        if (from && to) {
          callsWindowStart = new Date(from);
          callsWindowEnd = new Date(to);
        }

        log("INFO", `Calls window: ${callsWindowStart.toISOString()} -> ${callsWindowEnd.toISOString()}`);

        if ((adapter as any).fetchCallsRange) {
          calls = await (adapter as any).fetchCallsRange({
            from: callsWindowStart.toISOString(),
            to: callsWindowEnd.toISOString(),
          });
        } else if (adapter.fetchCalls) {
          calls = await adapter.fetchCalls(days); // fallback for adapters without range support
        } else {
          log("INFO", `Adapter for ${integration.name} does not support fetchCalls`);
          runResults["calls"] = { processed: 0, errors: 0, matched: 0, message: "Adapter does not support calls" };
        }

        if (calls.length > 0) {
          log("INFO", `Fetched ${calls.length} calls, processing...`);
          runResults["calls"] = await engine.processCalls(calls, integration.id);
          actionsExecuted.push("calls");
        } else if (!runResults["calls"]) {
          runResults["calls"] = { processed: 0, errors: 0, matched: 0, message: "No calls found" };
        }

        // Save debug log
        const callsDebugData = (adapter as any).getLastDebugData?.();
        if (callsDebugData?.rawCalls) {
          log("INFO", `Saving calls debug log for ${integration.name}...`);
          const callsDebugEntry = createDebugLogEntry(
            integration.name,
            "calls",
            callsDebugData.rawCalls,
            callsDebugData.processedCalls,
            callsDebugData.skipReasonMap || new Map()
          );
          await saveDebugLog(supabase, callsDebugEntry);
        }

        await upsertSyncState(supabase, integration.id, "calls", callsWindowEnd);
      } catch (callsErr) {
        const callsErrMsg = callsErr instanceof Error ? callsErr.message : String(callsErr);
        log("ERROR", `Error in calls sync: ${callsErrMsg}`);
        await recordSyncError(supabase, integration.id, "calls", callsErrMsg);
        runResults["calls"] = { processed: 0, errors: 1, message: callsErrMsg };
      }
    } else if (metaSyncRateLimited && actionList.includes("calls")) {
      actionsSkipped.push("calls");
      runResults["calls"] = { processed: 0, errors: 0, message: "Skipped: rate_limited_meta_abort" };
    }

    // Process sessions (skip if rate-limited or timeout approaching)
    if (actionList.includes("sessions") && !metaSyncRateLimited && !timer.isExpired()) {
      try {
        const syncState = await getSyncState(supabase, integration.id, "sessions");
        const windowStart = syncState?.last_success_at
          ? new Date(new Date(syncState.last_success_at).getTime() - 5 * 60 * 1000)
          : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(Date.now() - 2 * 60 * 1000);

        log("INFO", `Sessions window: ${windowStart.toISOString()} -> ${windowEnd.toISOString()}`);

        let sessions: any[] = [];
        if ((adapter as any).fetchSessionsRange) {
          sessions = await (adapter as any).fetchSessionsRange({
            from: windowStart.toISOString(),
            to: windowEnd.toISOString(),
          });
        } else if ((adapter as any).fetchSessions) {
          sessions = await (adapter as any).fetchSessions(days);
        } else {
          log("INFO", `Adapter for ${integration.name} does not support fetchSessions`);
          runResults["sessions"] = { processed: 0, errors: 0, matched: 0, message: "Adapter does not support sessions" };
        }

        if (sessions.length > 0) {
          log("INFO", `Fetched ${sessions.length} sessions, processing...`);
          runResults["sessions"] = await engine.processSessions(sessions, integration.id);
          actionsExecuted.push("sessions");
        } else if (!runResults["sessions"]) {
          runResults["sessions"] = { processed: 0, errors: 0, matched: 0, message: "No sessions found" };
        }

        await upsertSyncState(supabase, integration.id, "sessions", windowEnd);
      } catch (sessErr) {
        const sessErrMsg = sessErr instanceof Error ? sessErr.message : String(sessErr);
        log("ERROR", `Error in sessions sync: ${sessErrMsg}`);
        await recordSyncError(supabase, integration.id, "sessions", sessErrMsg);
        runResults["sessions"] = { processed: 0, errors: 1, message: sessErrMsg };
      }
    } else if (metaSyncRateLimited && actionList.includes("sessions")) {
      actionsSkipped.push("sessions");
      runResults["sessions"] = { processed: 0, errors: 0, message: "Skipped: rate_limited_meta_abort" };
    }

    // Check if timeout guard triggered any skips
    const timedOut = timer.isExpired();
    if (timedOut) {
      log("WARN", `Timeout guard: ${integration.name} hit ${timer.percentUsed().toFixed(0)}% budget (${timer.elapsed()}ms). Some actions may have been skipped.`);
      actionsSkipped.push("timeout_guard");
    }

    await supabase
      .from("dialer_integrations")
      .update({ last_sync_at: new Date().toISOString(), last_status: (metaSyncRateLimited || timedOut) ? "partial" : "success" })
      .eq("id", integration.id);

    // Determine final status
    const finalStatus: "success" | "partial_success" = (metaSyncRateLimited || timedOut) ? "partial_success" : "success";

    // Log summary
    const actionSummary = Object.entries(runResults)
      .map(([name, result]) => {
        const typedResult = result as { processed?: number; matched?: number; message?: string } | undefined;
        if (typedResult?.processed === undefined) return null;
        if (typedResult.message?.includes("Skipped")) return `${name}:skipped`;
        if (name === "calls") return `${typedResult.processed} calls (${typedResult.matched || 0} matched)`;
        return `${typedResult.processed} ${name}`;
      })
      .filter((part): part is string => Boolean(part));

    const totalRecords = Object.values(runResults).reduce((sum: number, r: any) => sum + (r?.processed || 0), 0);

    const syncMessage = actionSummary.length > 0
      ? `Sync ${finalStatus}: ${actionSummary.join(", ")} (total ${totalRecords})`
      : `Sync ${finalStatus}: No data processed`;

    const syncRunCompletedAt = new Date();
    const syncRunDurationMs = syncRunCompletedAt.getTime() - syncRunStartedAt.getTime();

    const adapterMetrics = adapter.getMetrics();

    log("INFO", `Sync completed: integration=${integration.name} status=${finalStatus} run_id=${runId} duration=${syncRunDurationMs}ms executed=[${actionsExecuted.join(",")}] skipped=[${actionsSkipped.join(",")}] records=${totalRecords}`);

    await supabase.from("integration_sync_runs").insert({
      integration_id: integration.id,
      started_at: syncRunStartedAt.toISOString(),
      completed_at: syncRunCompletedAt.toISOString(),
      duration_ms: syncRunDurationMs,
      status: finalStatus,
      actions: actionList.filter(Boolean) as string[],
      records_processed: totalRecords,
      api_calls_made: adapterMetrics.apiCalls,
      retries: adapterMetrics.retries,
      rate_limit_hits: adapterMetrics.rateLimitHits,
      run_id: runId,
      error_message: metaSyncRateLimited ? "rate_limited_meta_abort: heavy actions skipped" : null,
      rate_limit_daily_limit: adapterMetrics.rateLimitDailyLimit ?? null,
      rate_limit_remaining: adapterMetrics.rateLimitRemaining ?? null,
      rate_limit_reset: adapterMetrics.rateLimitReset ?? null,
    });

    await supabase.from("integration_logs").insert({
      integration_type: "dialer",
      integration_id: integration.id,
      integration_name: integration.name,
      status: finalStatus === "partial_success" ? "warning" : "success",
      message: syncMessage,
      duration_ms: syncRunDurationMs,
      details: {
        source,
        actions: actionList.filter(Boolean) as string[],
        actionsExecuted,
        actionsSkipped,
        days,
        campaignId: campaignId || null,
        results: runResults,
        runId,
      },
    });

    // Circuit breaker logic
    const heavilyRateLimited = adapterMetrics.rateLimitHits > 0 && adapterMetrics.rateLimitHits >= adapterMetrics.apiCalls * 0.5;
    if (heavilyRateLimited && totalRecords === 0) {
      const cbResult = await recordCircuitBreakerFailure(supabase, integration.id, `Sync succeeded but 100% rate-limited (${adapterMetrics.rateLimitHits}/${adapterMetrics.apiCalls})`);
      if (cbResult.pausedMinutes) {
        log("WARN", `Circuit breaker: ${integration.name} paused for ${cbResult.pausedMinutes} min – sync "succeeded" but yielded 0 records due to rate limits`);
      }
    } else {
      await resetCircuitBreaker(supabase, integration.id);
    }

    return { name: integration.name, status: finalStatus, data: runResults };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    log("ERROR", `Error in integration ${integration.name}: ${errMsg}`, {
      provider: source || integration.provider,
      integration: integration.name,
      runId,
    });

    const errorCompletedAt = new Date();
    const errorDurationMs = errorCompletedAt.getTime() - syncRunStartedAt.getTime();
    const errorMetrics = adapter?.getMetrics?.() ?? { apiCalls: 0, retries: 0, rateLimitHits: 0 };

    await supabase.from("integration_sync_runs").insert({
      integration_id: integration.id,
      started_at: syncRunStartedAt.toISOString(),
      completed_at: errorCompletedAt.toISOString(),
      duration_ms: errorDurationMs,
      status: "error",
      actions: actionList,
      records_processed: 0,
      api_calls_made: errorMetrics.apiCalls,
      retries: errorMetrics.retries,
      rate_limit_hits: errorMetrics.rateLimitHits,
      error_message: errMsg,
      run_id: runId,
      rate_limit_daily_limit: errorMetrics.rateLimitDailyLimit ?? null,
      rate_limit_remaining: errorMetrics.rateLimitRemaining ?? null,
      rate_limit_reset: errorMetrics.rateLimitReset ?? null,
    });

    await supabase.from("integration_logs").insert({
      integration_type: "dialer",
      integration_id: integration.id,
      integration_name: integration.name,
      status: "error",
      message: `Sync failed: ${errMsg}`,
      duration_ms: errorDurationMs,
      details: {
        source: options.source,
        actions: actionList,
        days: options.days,
        campaignId: options.campaignId || null,
        error: errMsg,
        runId,
      },
    });

    // Circuit breaker for rate-limit errors
    const isRateLimitError = errMsg.includes("429") || errMsg.includes("rate limit") || (errorMetrics.rateLimitHits > 0 && errorMetrics.rateLimitHits >= errorMetrics.apiCalls * 0.5);
    if (isRateLimitError) {
      const cbResult = await recordCircuitBreakerFailure(supabase, integration.id, errMsg);
      if (cbResult.pausedMinutes) {
        log("WARN", `Circuit breaker: ${integration.name} paused for ${cbResult.pausedMinutes} min after ${cbResult.newCount} consecutive rate-limit failures`);
      }
    }

    return { name: integration.name, status: "error", error: errMsg };
  } finally {
    // === Always release lock ===
    await releaseRunLock(supabase, integration.id, runId, log);
  }
}
