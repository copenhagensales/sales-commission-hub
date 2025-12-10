import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const integrationName = body.integration_name || "Lovablecph";
    const sampleSize = body.sample_size || 50; // How many leads to inspect
    
    // Get credentials from dialer_integrations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the integration by name
    const { data: integration, error: intError } = await supabase
      .from("dialer_integrations")
      .select("id, name, encrypted_credentials")
      .ilike("name", integrationName)
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ 
        error: `No se encontró integración: ${integrationName}`,
        details: intError?.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt credentials using RPC with encryption key
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: "DB_ENCRYPTION_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creds, error: decryptError } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration.id,
      p_encryption_key: encryptionKey
    });

    if (decryptError || !creds) {
      return new Response(JSON.stringify({ 
        error: `No se pudieron descifrar credenciales`,
        details: decryptError?.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { username, password } = creds;
    const authHeader = `Basic ${btoa(`${username}:${password}`)}`;
    const baseUrl = "https://api.adversus.io/v1";
    
    console.log(`[Diagnostics] Using integration: ${integrationName}`);

    // CORRECT APPROACH: Use /leads endpoint with filters - it has resultData!
    // First get unique campaign IDs from recent sales
    const salesUrl = `${baseUrl}/sales?pageSize=100&page=1`;
    console.log(`[Diagnostics] Fetching sales to get campaigns: ${salesUrl}`);
    
    const salesRes = await fetch(salesUrl, {
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    if (!salesRes.ok) {
      return new Response(JSON.stringify({ error: `Sales API error: ${salesRes.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const salesData = await salesRes.json();
    const sales = Array.isArray(salesData) ? salesData : (salesData.sales || []);
    console.log(`[Diagnostics] Got ${sales.length} sales`);

    // Get unique campaign IDs from sales (cast to number)
    const campaignIds: number[] = [...new Set(sales.map((s: any) => s.campaignId).filter(Boolean))] as number[];
    console.log(`[Diagnostics] Found ${campaignIds.length} unique campaigns:`, campaignIds);

    // Now fetch leads directly using filters - this is the key!
    const oppPattern = /OPP-\d{4,6}/;
    const salesWithOpp: { leadId: number; opp: string; fieldId: number; campaignId: number }[] = [];
    const allFieldIds = new Set<number>();
    const fieldValueSamples: Record<number, string[]> = {};
    const campaignStats: Record<number, { leadsFound: number; oppsFound: number }> = {};
    let totalLeadsInspected = 0;
    
    // Fetch leads for ALL campaigns with pageSize 5000
    for (const campaignId of campaignIds) {
      const filters = JSON.stringify({ campaignId: { "$eq": campaignId } });
      const leadsUrl = `${baseUrl}/leads?filters=${encodeURIComponent(filters)}&pageSize=5000`;
      
      console.log(`[Diagnostics] Fetching leads for campaign ${campaignId}...`);
      
      const leadsRes = await fetch(leadsUrl, {
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      });
      
      if (!leadsRes.ok) {
        console.log(`[Diagnostics] Failed for campaign ${campaignId}: ${leadsRes.status}`);
        continue;
      }
      
      const leadsData = await leadsRes.json();
      const leads = Array.isArray(leadsData) ? leadsData : (leadsData.leads || []);
      
      campaignStats[campaignId] = { leadsFound: leads.length, oppsFound: 0 };
      totalLeadsInspected += leads.length;
      console.log(`[Diagnostics] Campaign ${campaignId}: Got ${leads.length} leads`);
      
      // Check each lead for OPP in resultData
      for (const lead of leads) {
        const resultData = lead.resultData || [];
        
        if (Array.isArray(resultData)) {
          for (const field of resultData) {
            if (field && field.id !== undefined) {
              allFieldIds.add(field.id);
              
              // Collect samples
              if (!fieldValueSamples[field.id]) {
                fieldValueSamples[field.id] = [];
              }
              if (fieldValueSamples[field.id].length < 5 && field.value) {
                fieldValueSamples[field.id].push(String(field.value).substring(0, 100));
              }
              
              // Check for OPP pattern
              const value = String(field.value || '');
              const match = value.match(oppPattern);
              if (match) {
                campaignStats[campaignId].oppsFound++;
                salesWithOpp.push({
                  leadId: lead.id,
                  opp: match[0],
                  fieldId: field.id,
                  campaignId,
                });
              }
            }
          }
        }
      }
    }

    // Get unique OPP numbers
    const uniqueOpps = [...new Set(salesWithOpp.map(l => l.opp))];
    
    // Get field IDs used for OPP
    const oppFieldIds: Record<number, number> = {};
    for (const s of salesWithOpp) {
      oppFieldIds[s.fieldId] = (oppFieldIds[s.fieldId] || 0) + 1;
    }

    // Campaign distribution of OPPs
    const oppByCampaign: Record<number, number> = {};
    for (const s of salesWithOpp) {
      oppByCampaign[s.campaignId] = (oppByCampaign[s.campaignId] || 0) + 1;
    }

    // Convert allFieldIds to array with samples
    const fieldDetails = [...allFieldIds].sort((a, b) => a - b).map(id => ({
      id,
      sampleValues: fieldValueSamples[id] || [],
      oppCount: oppFieldIds[id] || 0
    }));

    return new Response(JSON.stringify({
      integrationName,
      totalSalesInPage: sales.length,
      campaignsAnalyzed: campaignIds.slice(0, 5),
      totalLeadsInspected,
      salesWithOppCount: salesWithOpp.length,
      uniqueOppNumbers: uniqueOpps.length,
      allFieldIdsFound: [...allFieldIds].sort((a, b) => a - b),
      fieldDetails: fieldDetails.filter(f => f.sampleValues.length > 0),
      oppFieldIds,
      oppByCampaign,
      campaignStats,
      sampleOpps: uniqueOpps.slice(0, 20),
      sampleSalesWithOpp: salesWithOpp.slice(0, 10),
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Diagnostics] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
