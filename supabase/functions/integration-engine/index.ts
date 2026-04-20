import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeLogger } from "./utils/logging.ts";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabase() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const log = makeLogger({ function: "integration-engine" });

  try {
    const body = await req.json();
    const {
      source,
      action,
      actions,
      days = 3,
      campaignId,
      integration_id,
      integrationId,
      background = false,
      from,
      to,
      maxRecords,
      datasets,
      campaignIds,
      uncapped,
    } = body;

    const effectiveMaxRecords = maxRecords ?? 200;
    const supabase = getSupabase();

    if (action === "check-rate-limits") {
      const effectiveIntegrationId = integrationId || integration_id;
      if (!effectiveIntegrationId) {
        return new Response(JSON.stringify({ success: false, error: "integration_id is required for check-rate-limits" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: integration, error: intError } = await supabase
        .from("dialer_integrations")
        .select("*")
        .eq("id", effectiveIntegrationId)
        .single();

      if (intError || !integration) {
        return new Response(JSON.stringify({ success: false, error: `Integration not found: ${effectiveIntegrationId}` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (integration.provider !== "enreach") {
        return new Response(JSON.stringify({ success: false, error: "check-rate-limits is only supported for Enreach integrations" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
      if (!encryptionKey) {
        return new Response(JSON.stringify({ success: false, error: "DB_ENCRYPTION_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: credData } = await supabase.rpc("get_dialer_credentials", {
        p_integration_id: effectiveIntegrationId,
        p_encryption_key: encryptionKey,
      });

      if (!credData) {
        return new Response(JSON.stringify({ success: false, error: "Could not decrypt credentials" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { EnreachAdapter } = await import("./adapters/enreach.ts");
      const adapter = new EnreachAdapter(credData as any, integration.name);
      const rateLimits = await adapter.fetchRateLimits();

      return new Response(JSON.stringify({
        success: true,
        action: "check-rate-limits",
        integration: { id: integration.id, name: integration.name },
        rateLimits,
        metrics: adapter.getMetrics(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "fetch-sample-fields") {
      const effectiveIntegrationId = integrationId || integration_id;
      const { fetchSampleFields } = await import("./actions/fetch-sample-fields.ts");
      const result = await fetchSampleFields(supabase, effectiveIntegrationId, log);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "repair-history") {
      const { repairHistory } = await import("./actions/repair-history.ts");
      if (background) {
        EdgeRuntime.waitUntil(repairHistory(supabase, days || 90, integration_id));
        return new Response(
          JSON.stringify({
            success: true,
            action: "repair-history",
            background: true,
            message: `Started background repair. Check logs for progress.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { totalProcessed, totalErrors, results } = await repairHistory(supabase, days || 90, integration_id);
      return new Response(
        JSON.stringify({
          success: true,
          action: "repair-history",
          days,
          totalProcessed,
          totalErrors,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "backfill") {
      const effectiveIntegrationId = integrationId || integration_id;
      if (!effectiveIntegrationId) {
        return new Response(JSON.stringify({ success: false, error: "integration_id is required for backfill" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { smartBackfill } = await import("./actions/smart-backfill.ts");
      if (background) {
        EdgeRuntime.waitUntil(smartBackfill(supabase, effectiveIntegrationId, log));
        return new Response(JSON.stringify({
          success: true,
          action: "backfill",
          background: true,
          message: "Started background backfill. Check logs for progress.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await smartBackfill(supabase, effectiveIntegrationId, log);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "provider-sync") {
      if (!source) {
        return new Response(JSON.stringify({ success: false, error: "source (provider) is required for provider-sync" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { providerSync } = await import("./actions/provider-sync.ts");
      if (background) {
        EdgeRuntime.waitUntil(providerSync(supabase, source, log));
        return new Response(JSON.stringify({
          success: true,
          action: "provider-sync",
          provider: source,
          background: true,
          message: `Started background provider-sync for ${source}. Check logs for progress.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await providerSync(supabase, source, log);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "safe-backfill") {
      const effectiveIntegrationId = integrationId || integration_id;
      if (!effectiveIntegrationId || !from || !to) {
        return new Response(JSON.stringify({ success: false, error: "integration_id, from, and to are required for safe-backfill" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const params = { integrationId: effectiveIntegrationId, from, to, maxRecordsPerDay: maxRecords || 600, datasets, campaignIds, uncapped };
      const { safeBackfill } = await import("./actions/safe-backfill.ts");

      if (background) {
        EdgeRuntime.waitUntil(safeBackfill(supabase, params, log));
        return new Response(JSON.stringify({
          success: true,
          action: "safe-backfill",
          background: true,
          message: `Started background safe-backfill for ${from} -> ${to}. Check logs for progress.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await safeBackfill(supabase, params, log);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ IngestionEngine }, { syncIntegration }] = await Promise.all([
      import("./core.ts"),
      import("./actions/sync-integration.ts"),
    ]);

    const engine = new IngestionEngine();
    const campaignMappings = await engine.getCampaignMappings();
    log("INFO", `Loaded ${campaignMappings.length} campaign mappings for reference extraction`);

    let query = supabase
      .from("dialer_integrations")
      .select("*")
      .eq("is_active", true);

    if (integration_id) {
      log("INFO", `Fetching specific integration: ${integration_id}`);
      query = query.eq("id", integration_id);
    } else if (source) {
      log("INFO", `Fetching all ${source} integrations`);
      query = query.eq("provider", source);
    }

    const { data: integrations, error } = await query;

    if (error) throw error;
    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: integration_id
            ? `Integración no encontrada o inactiva: ${integration_id}`
            : `No hay integraciones activas para ${source}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (background) {
      log("INFO", `Starting background sync for ${integrations.length} integration(s)`);

      const backgroundProcess = async () => {
        try {
          for (const integration of integrations) {
            await syncIntegration(supabase, integration, engine, campaignMappings, {
              source,
              action,
              actions,
              days,
              campaignId,
              from,
              to,
              maxRecords: effectiveMaxRecords,
            }, log);
          }
          log("INFO", `Background sync completed for ${integrations.length} integration(s)`);
        } catch (err) {
          log("ERROR", `Background sync failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      EdgeRuntime.waitUntil(backgroundProcess());

      return new Response(JSON.stringify({
        success: true,
        background: true,
        message: `Started background sync for ${integrations.length} integration(s). Check logs for progress.`,
        integrations: integrations.map(i => ({ id: i.id, name: i.name })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const integration of integrations) {
      const result = await syncIntegration(supabase, integration, engine, campaignMappings, {
        source,
        action,
        actions,
        days,
        campaignId,
        from,
        to,
        maxRecords: effectiveMaxRecords,
      }, log);
      results.push(result);
    }

    const totalCreated = results.reduce((acc, r) => {
      if (r.status === "success" && r.data?.sales && typeof r.data.sales === "object") {
        const salesData = r.data.sales as { processed?: number };
        return acc + (salesData.processed || 0);
      }
      return acc;
    }, 0);

    return new Response(JSON.stringify({
      success: true,
      results,
      created: totalCreated,
      updated: 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log("ERROR", "Integration engine error", { error: errMsg });
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});