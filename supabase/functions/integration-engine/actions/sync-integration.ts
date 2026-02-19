import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { IngestionEngine } from "../core.ts";
import { getAdapter } from "../adapters/registry.ts";
import { saveDebugLog, createDebugLogEntry, getSyncState, upsertSyncState, recordSyncError } from "../utils/index.ts";
import { CampaignMappingConfig } from "../types.ts";

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

interface SyncResult {
  name: string;
  status: "success" | "error";
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Process a single integration sync
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
  const syncRunStartedAt = new Date();
  let adapter: any = null;
  try {
    log("INFO", `Processing integration: ${integration.name}`);

    // Get decrypted credentials
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
    const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration.id,
      p_encryption_key: encryptionKey,
    });

    adapter = getAdapter(
      source || integration.provider,
      credentials,
      integration.name,
      integration.api_url,
      integration.config,
      integration.calls_org_codes
    );

    const runResults: Record<string, unknown> = {};

    // Support both 'action' (legacy) and 'actions' (new array)
    const actionList = actions || (action === "sync" ? ["campaigns", "users", "sales", "sessions"] : [action]);

    // Process campaigns
    if (actionList.includes("campaigns")) {
      const campaigns = await adapter.fetchCampaigns();
      runResults["campaigns"] = await engine.processCampaigns(campaigns);
    }

    // Process users
    if (actionList.includes("users")) {
      const users = await adapter.fetchUsers();
      const dialerSource = (source || integration.provider) === "enreach" ? "enreach" : "adversus";
      runResults["users"] = await engine.processUsers(users, dialerSource);
    }

    // Process sales
    if (actionList.includes("sales") || action === "sync") {
      const useRange = from && to;
      let sales: any[] = [];
      
      if (useRange && (adapter as any).fetchSalesRange) {
        log("INFO", `Fetching sales by range ${from} -> ${to}`);
        sales = await (adapter as any).fetchSalesRange({ from, to }, campaignMappings);
      } else {
        sales = await adapter.fetchSales(days, campaignMappings);
      }
      
      if (campaignId) {
        log("INFO", `Filtering sales for campaign: ${campaignId}`);
        const beforeCount = sales.length;
        sales = sales.filter((s: any) => s.campaignId === String(campaignId));
        log("INFO", `Filtered ${beforeCount} -> ${sales.length} sales for campaign ${campaignId}`);
      }

      // Sort sales by date DESCENDING (newest first) before applying limit
      // This ensures today's sales are always processed first, regardless of backlog size
      sales.sort((a, b) => {
        const dateA = new Date(a.saleDate || a.date || 0).getTime();
        const dateB = new Date(b.saleDate || b.date || 0).getTime();
        return dateB - dateA; // Newest first
      });

      // Apply max records limit to prevent CPU timeout
      if (maxRecords && sales.length > maxRecords) {
        log("INFO", `Limiting sales from ${sales.length} to ${maxRecords} (keeping newest)`);
        sales = sales.slice(0, maxRecords);
      }

      // Use smaller batch size (200) to reduce CPU pressure
      runResults["sales"] = await engine.processSales(sales, 200);

      // Save debug log if adapter supports it
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
    }

    // Process calls (CDR - GDPR Compliant)
    if (actionList.includes("calls")) {
      let calls: any[] = [];
      
      if ((adapter as any).fetchCallsRange && from && to) {
        log("INFO", `Fetching calls by range ${from} -> ${to}`);
        calls = await (adapter as any).fetchCallsRange({ from, to });
        log("INFO", `Fetched ${calls.length} calls`);
        runResults["calls"] = await engine.processCalls(calls, integration.id);
      } else if (adapter.fetchCalls) {
        log("INFO", `Fetching calls for ${integration.name}...`);
        calls = await adapter.fetchCalls(days);
        log("INFO", `Fetched ${calls.length} calls`);
        runResults["calls"] = await engine.processCalls(calls, integration.id);
      } else {
        log("INFO", `Adapter for ${integration.name} does not support fetchCalls`);
        runResults["calls"] = { processed: 0, errors: 0, matched: 0, message: "Adapter does not support calls" };
      }

      // Save debug log for calls
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
    }

    // Process sessions (ALL outcomes for hitrate analytics)
    if (actionList.includes("sessions")) {
      try {
        // 1. Read sync state for incremental window
        const syncState = await getSyncState(supabase, integration.id, "sessions");
        
        // 2. Calculate window
        //    start = last_success_at - 5min overlap (catch late-registered records)
        //    stop = now - 2min (avoid in-flight records)
        //    Fallback for new integration: days parameter
        const windowStart = syncState?.last_success_at
          ? new Date(new Date(syncState.last_success_at).getTime() - 5 * 60 * 1000)
          : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(Date.now() - 2 * 60 * 1000);

        log("INFO", `Sessions window: ${windowStart.toISOString()} -> ${windowEnd.toISOString()}`);

        // 3. Fetch via adapter
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

        // 4. Process and upsert
        if (sessions.length > 0) {
          log("INFO", `Fetched ${sessions.length} sessions, processing...`);
          runResults["sessions"] = await engine.processSessions(sessions, integration.id);
        } else if (!runResults["sessions"]) {
          runResults["sessions"] = { processed: 0, errors: 0, matched: 0, message: "No sessions found" };
        }

        // 5. Update sync state on success
        await upsertSyncState(supabase, integration.id, "sessions", windowEnd);
      } catch (sessErr) {
        const sessErrMsg = sessErr instanceof Error ? sessErr.message : String(sessErr);
        log("ERROR", `Error in sessions sync: ${sessErrMsg}`);
        await recordSyncError(supabase, integration.id, "sessions", sessErrMsg);
        runResults["sessions"] = { processed: 0, errors: 1, message: sessErrMsg };
      }
    }

    await supabase
      .from("dialer_integrations")
      .update({ last_sync_at: new Date().toISOString(), last_status: "success" })
      .eq("id", integration.id);

    // Log success to integration_logs
    const salesData = runResults["sales"] as { processed?: number } | undefined;
    const callsData = runResults["calls"] as { processed?: number; matched?: number } | undefined;

    const messageParts: string[] = [];
    if (salesData?.processed !== undefined) {
      messageParts.push(`${salesData.processed} sales`);
    }
    if (callsData?.processed !== undefined) {
      messageParts.push(`${callsData.processed} calls (${callsData.matched || 0} matched)`);
    }
    const syncMessage = messageParts.length > 0
      ? `Sync completed: ${messageParts.join(", ")}`
      : "Sync completed: No data processed";

    // Calculate total records processed
    const totalRecords = Object.values(runResults).reduce((sum: number, r: any) => sum + (r?.processed || 0), 0);

    // Calculate sync run duration
    const syncRunCompletedAt = new Date();
    const syncRunDurationMs = syncRunCompletedAt.getTime() - syncRunStartedAt.getTime();

    // Get API metrics from adapter
    const adapterMetrics = adapter.getMetrics();

    // Insert into integration_sync_runs
    await supabase.from("integration_sync_runs").insert({
      integration_id: integration.id,
      started_at: syncRunStartedAt.toISOString(),
      completed_at: syncRunCompletedAt.toISOString(),
      duration_ms: syncRunDurationMs,
      status: "success",
      actions: actionList.filter(Boolean) as string[],
      records_processed: totalRecords,
      api_calls_made: adapterMetrics.apiCalls,
      retries: adapterMetrics.retries,
      rate_limit_hits: adapterMetrics.rateLimitHits,
    });

    await supabase.from("integration_logs").insert({
      integration_type: "dialer",
      integration_id: integration.id,
      integration_name: integration.name,
      status: "success",
      message: syncMessage,
      duration_ms: syncRunDurationMs,
      details: {
        source,
        days,
        campaignId: campaignId || null,
        results: runResults,
      },
    });

    return { name: integration.name, status: "success", data: runResults };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    log("ERROR", `Error in integration ${integration.name}: ${errMsg}`);

    // Calculate error run duration
    const errorCompletedAt = new Date();
    const errorDurationMs = errorCompletedAt.getTime() - syncRunStartedAt.getTime();

    // Get partial metrics from adapter (may have partial data before error)
    const errorMetrics = adapter?.getMetrics?.() ?? { apiCalls: 0, retries: 0, rateLimitHits: 0 };

    // Insert error sync run
    await supabase.from("integration_sync_runs").insert({
      integration_id: integration.id,
      started_at: syncRunStartedAt.toISOString(),
      completed_at: errorCompletedAt.toISOString(),
      duration_ms: errorDurationMs,
      status: "error",
      actions: (actions || (action ? [action] : [])) as string[],
      records_processed: 0,
      api_calls_made: errorMetrics.apiCalls,
      retries: errorMetrics.retries,
      rate_limit_hits: errorMetrics.rateLimitHits,
      error_message: errMsg,
    });

    // Log error to integration_logs
    await supabase.from("integration_logs").insert({
      integration_type: "dialer",
      integration_id: integration.id,
      integration_name: integration.name,
      status: "error",
      message: `Sync failed: ${errMsg}`,
      duration_ms: errorDurationMs,
      details: {
        source: options.source,
        days: options.days,
        campaignId: options.campaignId || null,
        error: errMsg,
      },
    });

    return { name: integration.name, status: "error", error: errMsg };
  }
}
