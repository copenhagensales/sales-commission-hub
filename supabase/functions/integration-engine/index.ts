import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { IngestionEngine } from "./core.ts";
import { AdversusAdapter } from "./adapters/adversus.ts";
import { EnreachAdapter } from "./adapters/enreach.ts";
import { DialerAdapter } from "./adapters/interface.ts";

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
    const { source, action, actions, days = 1, campaignId, integration_id, background = false } = body;

    const supabase = getSupabase();

    // Handle fetch-sample-fields action - returns raw field data for UI inspection
    if (action === "fetch-sample-fields") {
      console.log(`[Integration Engine] Fetching sample fields for campaign: ${campaignId}`);
      
      const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
      
      // Get active Adversus integration
      const { data: integrations, error: intError } = await supabase
        .from("dialer_integrations")
        .select("*")
        .eq("provider", source || "adversus")
        .eq("is_active", true)
        .limit(1);

      if (intError) throw intError;
      if (!integrations || integrations.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "No active integration found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const integration = integrations[0];
      const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
        p_integration_id: integration.id,
        p_encryption_key: encryptionKey,
      });

      // Create adapter and fetch leads for the campaign
      const adapter = new AdversusAdapter(credentials, integration.name);
      const leads = await adapter.fetchLeadsForCampaign(campaignId, 100);

      if (leads.length === 0) {
        console.log(`[Integration Engine] No leads found for campaign ${campaignId}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            fields: [], 
            message: `No leads found for campaign ${campaignId}` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract resultData fields from first lead with data
      const fields: { fieldId: string; label: string; sampleValue: string }[] = [];
      const sampleLead = leads.find((l: any) => l.resultData && l.resultData.length > 0) || leads[0];
      const resultData = sampleLead?.resultData || [];

      if (Array.isArray(resultData)) {
        for (const field of resultData) {
          if (field.id !== undefined) {
            fields.push({
              fieldId: `result_${field.id}`,
              label: `Field ${field.id}`,
              sampleValue: field.value !== null && field.value !== undefined ? String(field.value) : "(empty)",
            });
          }
        }
      }

      // Sort fields alphabetically by fieldId
      fields.sort((a, b) => a.fieldId.localeCompare(b.fieldId));

      console.log(`[Integration Engine] Found ${fields.length} fields from ${leads.length} leads`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          fields,
          leadCount: leads.length,
          sampleLeadId: sampleLead?.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle repair-history action - bulk fetch and update historical sales
    if (action === "repair-history") {
      console.log(`[Integration Engine] Starting historical repair (${days} days)${integration_id ? ` for integration: ${integration_id}` : ''}${background ? ' [BACKGROUND]' : ''}`);
      const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
      
      // Build query - support specific integration or all active Adversus integrations
      let query = supabase
        .from("dialer_integrations")
        .select("*")
        .eq("is_active", true);
      
      if (integration_id) {
        query = query.eq("id", integration_id);
      } else {
        query = query.eq("provider", "adversus");
      }
      
      const { data: integrations, error: intError } = await query;

      if (intError) throw intError;
      if (!integrations || integrations.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: integration_id ? "Integration not found or inactive" : "No active Adversus integrations found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Background processing function
      async function runRepairHistory() {
        const engine = new IngestionEngine();
        const campaignMappings = await engine.getCampaignMappings();
        
        let totalProcessed = 0;
        let totalErrors = 0;
        const results: { name: string; status: string; processed?: number; errors?: number; error?: string }[] = [];

        for (const integration of integrations!) {
          try {
            console.log(`[Integration Engine] Processing integration: ${integration.name}`);
            
            const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
              p_integration_id: integration.id,
              p_encryption_key: encryptionKey,
            });

            const adapter = new AdversusAdapter(credentials, integration.name);
            
            // Fetch all sales for the specified period (default 90 days for repair)
            const sales = await adapter.fetchSales(days || 90, campaignMappings);
            console.log(`[Integration Engine] Fetched ${sales.length} sales for ${integration.name}`);
            
            // Process sales - core.ts handles non-destructive OPP updates
            const result = await engine.processSales(sales);
            
            totalProcessed += result.processed;
            totalErrors += result.errors;
            
            results.push({ 
              name: integration.name, 
              status: "success", 
              processed: result.processed,
              errors: result.errors 
            });

            // Log success
            await supabase.from("integration_logs").insert({
              integration_type: "dialer",
              integration_id: integration.id,
              integration_name: integration.name,
              status: "success",
              message: `Historical repair: ${result.processed} sales processed`,
              details: { action: "repair-history", days, processed: result.processed, errors: result.errors },
            });

          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            console.error(`[Integration Engine] Error in ${integration.name}:`, e);
            totalErrors++;
            results.push({ name: integration.name, status: "error", error: errMsg });
            
            // Log error
            await supabase.from("integration_logs").insert({
              integration_type: "dialer",
              integration_id: integration.id,
              integration_name: integration.name,
              status: "error",
              message: `Historical repair failed: ${errMsg}`,
              details: { action: "repair-history", days, error: errMsg },
            });
          }
        }
        
        console.log(`[Integration Engine] Repair complete: ${totalProcessed} processed, ${totalErrors} errors`);
        return { totalProcessed, totalErrors, results };
      }

      // If background mode, use waitUntil and return immediately
      if (background) {
        EdgeRuntime.waitUntil(runRepairHistory());
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "repair-history",
            background: true,
            message: `Started background repair for ${integrations.length} integration(s). Check logs for progress.`,
            integrations: integrations.map(i => i.name),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Synchronous mode - wait for completion
      const { totalProcessed, totalErrors, results } = await runRepairHistory();

      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "repair-history",
          days,
          totalProcessed,
          totalErrors,
          results 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

        let dialerAdapter: DialerAdapter;
        if (integration.provider === "adversus" || source === "adversus") {
          // Pass the integration name as the dialer name
          dialerAdapter = new AdversusAdapter(credentials, integration.name);
        } else if (integration.provider === "enreach" || source === "enreach") {
          // Pass the integration name as the dialer name and api_url from the integration record
          const enreachCredentials = {
            ...credentials,
            api_url: integration.api_url, // Include the api_url from the integration record
          };
          console.log(`[Integration Engine] Enreach api_url from DB: ${integration.api_url}`);
          dialerAdapter = new EnreachAdapter(enreachCredentials, integration.name);
        } else {
          throw new Error(`Fuente no soportada: ${source || integration.provider}`);
        }
        adapter = dialerAdapter;

        const runResults: Record<string, unknown> = {};

        // Soportar tanto 'action' (legacy) como 'actions' (nuevo array)
        const actionList = actions || (action === "sync" ? ["sales"] : [action]);

        if (actionList.includes("campaigns")) {
          const campaigns = await adapter.fetchCampaigns();
          runResults["campaigns"] = await engine.processCampaigns(campaigns);
        }

        if (actionList.includes("users")) {
          const users = await adapter.fetchUsers();
          runResults["users"] = await engine.processUsers(users);
        }

        if (actionList.includes("sales") || action === "sync") {
          // Pass campaignMappings to adapter for reference extraction
          let sales = await adapter.fetchSales(days, campaignMappings);
          
          // Filter by campaignId if provided (for retroactive sync)
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
          if (adapter.fetchCalls) {
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
        await supabase.from("integration_logs").insert({
          integration_type: "dialer",
          integration_id: integration.id,
          integration_name: integration.name,
          status: "success",
          message: `Sync completed: ${salesData?.processed || 0} sales processed`,
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
