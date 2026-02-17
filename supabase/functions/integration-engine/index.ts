import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { IngestionEngine } from "./core.ts";
import { fetchSampleFields } from "./actions/fetch-sample-fields.ts";
import { repairHistory } from "./actions/repair-history.ts";
import { syncIntegration } from "./actions/sync-integration.ts";
import { makeLogger } from "./utils/index.ts";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to create Supabase client
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
    const { source, action, actions, days = 3, campaignId, integration_id, integrationId, background = false, from, to, maxRecords } = body;
    
    // Balanced limit: 50 records per sync to handle backlog while preventing CPU timeout
    const effectiveMaxRecords = maxRecords ?? 200;

    const supabase = getSupabase();

    // Handle fetch-sample-fields action
    if (action === "fetch-sample-fields") {
      // Support both integrationId (from frontend) and integration_id
      const effectiveIntegrationId = integrationId || integration_id;
      const result = await fetchSampleFields(supabase, effectiveIntegrationId, log);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle repair-history action
    if (action === "repair-history") {
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

    // Initialize engine and fetch campaign mappings
    const engine = new IngestionEngine();
    const campaignMappings = await engine.getCampaignMappings();
    log("INFO", `Loaded ${campaignMappings.length} campaign mappings for reference extraction`);

    // Build query for integrations
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

    // Background processing mode - run in background and return immediately
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

    // Foreground processing - process one at a time to reduce CPU pressure
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

    // Calculate aggregate stats
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
