import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { IngestionEngine } from "./core.ts";
import { AdversusAdapter } from "./adapters/adversus.ts";
import { EnreachAdapter } from "./adapters/enreach.ts";
import { DialerAdapter } from "./adapters/interface.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { source, action, actions, days = 1, campaignId } = await req.json();

    // Inicializar Supabase para buscar configuraciones
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

      // Create adapter and fetch sales with enriched lead data
      const adapter = new AdversusAdapter(credentials, integration.name);
      const salesWithData = await adapter.fetchSalesWithLeadData(days || 30, campaignId);

      if (salesWithData.length === 0) {
        console.log(`[Integration Engine] No sales with lead data found for campaign ${campaignId}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            fields: [], 
            message: `No sales found for campaign ${campaignId} in last ${days || 30} days` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract resultData fields from first sale with data
      const { sale, resultData } = salesWithData[0];

      // Format fields for the UI
      const fields: { fieldId: string; label: string; sampleValue: string }[] = [];
      for (const [key, value] of Object.entries(resultData)) {
        fields.push({
          fieldId: key,
          label: key, // Adversus doesn't provide labels separately
          sampleValue: value !== null && value !== undefined ? String(value) : "(empty)",
        });
      }

      // Sort fields alphabetically by fieldId
      fields.sort((a, b) => a.fieldId.localeCompare(b.fieldId));

      console.log(`[Integration Engine] Found ${fields.length} fields in sample sale (leadId: ${sale.leadId})`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          fields,
          saleCount: salesWithData.length,
          sampleSaleId: sale.id,
          leadId: sale.leadId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const engine = new IngestionEngine();

    // Buscar todas las integraciones activas del tipo solicitado
    const { data: integrations, error } = await supabase
      .from("dialer_integrations")
      .select("*")
      .eq("provider", source)
      .eq("is_active", true);

    if (error) throw error;
    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `No hay integraciones activas para ${source}`,
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
        if (source === "adversus") {
          // Pass the integration name as the dialer name
          dialerAdapter = new AdversusAdapter(credentials, integration.name);
        } else if (source === "enreach") {
          // Pass the integration name as the dialer name
          dialerAdapter = new EnreachAdapter(credentials, integration.name);
        } else {
          throw new Error(`Fuente no soportada: ${source}`);
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
          let sales = await adapter.fetchSales(days);
          
          // Filter by campaignId if provided (for retroactive sync)
          if (campaignId) {
            console.log(`[Integration Engine] Filtering sales for campaign: ${campaignId}`);
            const beforeCount = sales.length;
            sales = sales.filter(s => s.campaignId === String(campaignId));
            console.log(`[Integration Engine] Filtered ${beforeCount} -> ${sales.length} sales for campaign ${campaignId}`);
          }
          
          runResults["sales"] = await engine.processSales(sales);
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
