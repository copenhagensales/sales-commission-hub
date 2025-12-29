import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { IngestionEngine } from "./core.ts";
import { DialerAdapter } from "./adapters/interface.ts";
import { getAdapter } from "./adapters/registry.ts";
import { fetchSampleFields } from "./actions/fetch-sample-fields.ts";
import { repairHistory } from "./actions/repair-history.ts";

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

  try {
    const body = await req.json();
    const { source, action, actions, days = 1, campaignId, integration_id, background = false, from, to } = body;

    const supabase = getSupabase();

    // Handle fetch-sample-fields action - returns raw field data for UI inspection
    if (action === "fetch-sample-fields") {
      const result = await fetchSampleFields(supabase, source, campaignId);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle repair-history action - bulk fetch and update historical sales
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
        )
      }
      const { totalProcessed, totalErrors, results } = await repairHistory(supabase, days || 90, integration_id)
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
      )
    }

    // integration_id already parsed from body above
    
    const engine = new IngestionEngine();
    
    // Fetch campaign mappings ONCE at the start for reference extraction
    const campaignMappings = await engine.getCampaignMappings();
    console.log(`[Integration Engine] Loaded ${campaignMappings.length} campaign mappings for reference extraction`);

    // Build query - if integration_id is provided, only fetch that specific one
    let query = supabase
      .from("dialer_integrations")
      .select("*")
      .eq("is_active", true);
    
    if (integration_id) {
      // Sync specific integration by ID
      console.log(`[Integration Engine] Fetching specific integration: ${integration_id}`);
      query = query.eq("id", integration_id);
    } else if (source) {
      // Sync all integrations of a specific provider type
      console.log(`[Integration Engine] Fetching all ${source} integrations`);
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

    const results = [];

    // Iterar sobre cada cuenta (Multi-tenancy)
    for (const integration of integrations) {
      console.log(`Procesando cuenta: ${integration.name}`);

      let adapter;
      try {
        // Obtener credenciales desencriptadas
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
          integration.config
        );

        const runResults: Record<string, unknown> = {};

        // Soportar tanto 'action' (legacy) como 'actions' (nuevo array)
        // Default sync now includes campaigns + sales to ensure campaign names are always up to date
        const actionList = actions || (action === "sync" ? ["campaigns", "sales"] : [action]);

        if (actionList.includes("campaigns")) {
          const campaigns = await adapter.fetchCampaigns();
          runResults["campaigns"] = await engine.processCampaigns(campaigns);
        }

        if (actionList.includes("users")) {
          const users = await adapter.fetchUsers();
          const dialerSource = (source || integration.provider) === "enreach" ? "enreach" : "adversus";
          runResults["users"] = await engine.processUsers(users, dialerSource);
        }

        if (actionList.includes("sales") || action === "sync") {
          const useRange = from && to;
          let sales: any[] = [];
          if (useRange && (adapter as any).fetchSalesRange) {
            console.log(`[Integration Engine] Fetching sales by range ${from} -> ${to}`);
            sales = await (adapter as any).fetchSalesRange({ from, to }, campaignMappings);
          } else {
            sales = await adapter.fetchSales(days, campaignMappings);
          }
          if (campaignId) {
            console.log(`[Integration Engine] Filtering sales for campaign: ${campaignId}`);
            const beforeCount = sales.length;
            sales = sales.filter(s => s.campaignId === String(campaignId));
            console.log(`[Integration Engine] Filtered ${beforeCount} -> ${sales.length} sales for campaign ${campaignId}`);
          }
          runResults["sales"] = await engine.processSales(sales);
        }

        // --- CALLS (CDR - GDPR Compliant) ---
        if (actionList.includes("calls")) {
          if ((adapter as any).fetchCallsRange && from && to) {
            console.log(`[Integration Engine] Fetching calls by range ${from} -> ${to}`);
            const calls = await (adapter as any).fetchCallsRange({ from, to });
            console.log(`[Integration Engine] Fetched ${calls.length} calls`);
            runResults["calls"] = await engine.processCalls(calls);
          } else if (adapter.fetchCalls) {
            console.log(`[Integration Engine] Fetching calls for ${integration.name}...`);
            const calls = await adapter.fetchCalls(days);
            console.log(`[Integration Engine] Fetched ${calls.length} calls`);
            runResults["calls"] = await engine.processCalls(calls);
          } else {
            console.log(`[Integration Engine] Adapter for ${integration.name} does not support fetchCalls`);
            runResults["calls"] = { processed: 0, errors: 0, matched: 0, message: "Adapter does not support calls" };
          }
        }

        // Actualizar timestamp de última sincronización
        await supabase
          .from("dialer_integrations")
          .update({ last_sync_at: new Date().toISOString(), last_status: "success" })
          .eq("id", integration.id);

        // Log success to integration_logs
        const salesData = runResults["sales"] as { processed?: number } | undefined;
        const callsData = runResults["calls"] as { processed?: number; matched?: number } | undefined;
        
        // Build message based on what was synced
        const messageParts: string[] = [];
        if (salesData?.processed !== undefined) {
          messageParts.push(`${salesData.processed} sales`);
        }
        if (callsData?.processed !== undefined) {
          messageParts.push(`${callsData.processed} calls (${callsData.matched || 0} matched)`);
        }
        const syncMessage = messageParts.length > 0 
          ? `Sync completed: ${messageParts.join(', ')}`
          : 'Sync completed: No data processed';
        
        await supabase.from("integration_logs").insert({
          integration_type: "dialer",
          integration_id: integration.id,
          integration_name: integration.name,
          status: "success",
          message: syncMessage,
          details: {
            source,
            days,
            campaignId: campaignId || null,
            results: runResults,
          },
        });

        results.push({ name: integration.name, status: "success", data: runResults });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error(`Error en integración ${integration.name}:`, e);

        // Log error to integration_logs
        await supabase.from("integration_logs").insert({
          integration_type: "dialer",
          integration_id: integration.id,
          integration_name: integration.name,
          status: "error",
          message: `Sync failed: ${errMsg}`,
          details: {
            source,
            days,
            campaignId: campaignId || null,
            error: errMsg,
          },
        });

        results.push({ name: integration.name, status: "error", error: errMsg });
      }
    }

    // Calculate aggregate stats for response
    const totalCreated = results.reduce((acc, r) => {
      if (r.status === 'success' && r.data?.sales && typeof r.data.sales === 'object') {
        const salesData = r.data.sales as { processed?: number };
        return acc + (salesData.processed || 0);
      }
      return acc;
    }, 0);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      created: totalCreated,
      updated: 0, // core.ts doesn't distinguish created vs updated yet
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Integration engine error:", error);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
