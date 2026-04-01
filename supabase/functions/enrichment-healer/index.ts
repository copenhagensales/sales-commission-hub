import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/**
 * Provider budget limits for healer (normal vs turbo)
 */
const HEALER_BUDGETS: Record<string, { normal: number; turbo: number }> = {
  adversus: { normal: 150, turbo: 800 },
  enreach: { normal: 1500, turbo: 5000 },
};

/**
 * Get current API usage for a provider in the last 60 minutes
 */
async function getProviderUsage(supabase: any, provider: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: integrations } = await supabase
    .from("dialer_integrations")
    .select("id")
    .eq("provider", provider)
    .eq("is_active", true);

  if (!integrations || integrations.length === 0) return 0;

  const { data: runs } = await supabase
    .from("integration_sync_runs")
    .select("api_calls_made")
    .in("integration_id", integrations.map((i: any) => i.id))
    .gte("started_at", oneHourAgo);

  return (runs || []).reduce((sum: number, r: any) => sum + (r.api_calls_made || 0), 0);
}

/**
 * Get credentials for a specific integration by name (source)
 */
async function getCredentialsByName(supabase: any, name: string): Promise<{ credentials: any; integration: any } | null> {
  const { data: integrations } = await supabase
    .from("dialer_integrations")
    .select("id, name, provider, api_url, config")
    .eq("is_active", true)
    .ilike("name", name);

  if (!integrations || integrations.length === 0) return null;

  const integration = integrations[0];
  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
  
  const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
    p_integration_id: integration.id,
    p_encryption_key: encryptionKey,
  });

  return { credentials, integration };
}

/**
 * Heal Adversus sales by re-fetching lead data
 */
async function healAdversus(
  supabase: any,
  sales: any[],
  credentials: any,
  log: (msg: string) => void,
  turboMode = false
): Promise<{ healed: number; failed: number; skipped: number }> {
  let healed = 0, failed = 0, skipped = 0;

  const user = credentials?.username || credentials?.ADVERSUS_API_USERNAME;
  const pass = credentials?.password || credentials?.ADVERSUS_API_PASSWORD;
  if (!user || !pass) {
    log("No Adversus credentials found (need username+password), skipping all");
    return { healed: 0, failed: 0, skipped: sales.length };
  }
  const authHeader = "Basic " + btoa(`${user}:${pass}`);

  for (const sale of sales) {
    const rawPayload = sale.raw_payload || {};
    const leadId = rawPayload.leadId || rawPayload.metadata?.leadId;

    if (!leadId) {
      await supabase.from("sales").update({
        enrichment_status: "skipped",
        enrichment_error: "no_lead_identifier",
        enrichment_attempts: (sale.enrichment_attempts || 0) + 1,
        enrichment_last_attempt: new Date().toISOString(),
      }).eq("id", sale.id);
      skipped++;
      continue;
    }

    try {
      const response = await fetch(`https://api.adversus.io/v1/leads/${leadId}`, {
        headers: { Authorization: authHeader },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawLeadResponse = await response.json();
      // Adversus API may return {leads: [...]} or the lead object directly
      let leadData = rawLeadResponse;
      if (rawLeadResponse.leads && Array.isArray(rawLeadResponse.leads)) {
        if (rawLeadResponse.leads.length === 0) {
          throw new Error("API returned empty leads array");
        }
        leadData = rawLeadResponse.leads[0];
      }
      log(`Lead ${leadId} keys: ${JSON.stringify(Object.keys(leadData)).substring(0, 200)}`);
      const leadResultData = leadData.resultData || leadData.leadResultData || [];

      const leadResultFields: Record<string, any> = {};
      if (Array.isArray(leadResultData)) {
        for (const field of leadResultData) {
          const fieldName = field?.name || field?.label;
          if (field && fieldName !== undefined) {
            leadResultFields[fieldName] = field.value;
          }
        }
      }

      let phone = leadData.phone || leadData.contactPhone || leadData.mobile || null;
      if (!phone && leadData.contactData) {
        const cd = leadData.contactData;
        phone = cd.Telefonnummer1 || cd['Kontakt nummer'] || cd.phone || cd.mobile || cd.Mobil || cd.Telefon || null;
      }

      // Check if we got ANY useful data from the API (not just resultData)
      const hasResultData = (Array.isArray(leadResultData) && leadResultData.length > 0) || Object.keys(leadResultFields).length > 0;
      const hasContactData = leadData.contactData && Object.keys(leadData.contactData).length > 0;
      const hasPhone = !!phone;
      const hasAnyData = hasResultData || hasContactData || hasPhone || leadData.campaignId || leadData.status;

      if (!hasAnyData) {
        throw new Error("API returned empty lead data");
      }

      const updatedPayload = {
        ...rawPayload,
        leadResultFields,
        leadResultData,
        ...(leadData.contactData ? { contactData: leadData.contactData } : {}),
        ...(leadData.status ? { leadStatus: leadData.status } : {}),
        ...(leadData.campaignId ? { campaignId: leadData.campaignId } : {}),
      };

      await supabase.from("sales").update({
        raw_payload: updatedPayload,
        enrichment_status: "healed",
        enrichment_error: null,
        enrichment_attempts: (sale.enrichment_attempts || 0) + 1,
        enrichment_last_attempt: new Date().toISOString(),
        ...(phone && !sale.customer_phone ? { customer_phone: phone } : {}),
      }).eq("id", sale.id);

      healed++;
      log(`Healed Adversus sale ${sale.adversus_external_id} (lead ${leadId})`);

      await new Promise(r => setTimeout(r, turboMode ? 5000 : 6000));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await supabase.from("sales").update({
        enrichment_status: "failed",
        enrichment_error: errMsg,
        enrichment_attempts: (sale.enrichment_attempts || 0) + 1,
        enrichment_last_attempt: new Date().toISOString(),
      }).eq("id", sale.id);
      failed++;
      log(`Failed to heal Adversus sale ${sale.adversus_external_id}: ${errMsg}`);
    }
  }

  return { healed, failed, skipped };
}

/**
 * Heal Enreach sales by re-fetching lead data
 */
async function healEnreach(
  supabase: any,
  sales: any[],
  credentials: any,
  integration: any,
  log: (msg: string) => void,
  turboMode = false
): Promise<{ healed: number; failed: number; skipped: number }> {
  let healed = 0, failed = 0, skipped = 0;

  let apiUrl = integration?.api_url || credentials?.api_url || "https://wshero01.herobase.com/api";
  apiUrl = apiUrl.replace(/^(Web|URL|API|Endpoint):\s*/i, '').trim();
  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    apiUrl = 'https://' + apiUrl;
  }
  if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
  if (!apiUrl.endsWith('/api')) apiUrl = apiUrl + '/api';

  let authHeader: string;
  const user = credentials?.username;
  const pass = credentials?.password;
  const apiToken = credentials?.api_token;

  if (user && pass) {
    authHeader = "Basic " + btoa(`${user}:${pass}`);
  } else if (apiToken && apiToken.includes(':')) {
    authHeader = "Basic " + btoa(apiToken);
  } else if (apiToken) {
    authHeader = `Bearer ${apiToken}`;
  } else {
    log("No Enreach credentials found (need username+password or api_token), skipping all");
    return { healed: 0, failed: 0, skipped: sales.length };
  }

  for (const sale of sales) {
    const externalId = sale.adversus_external_id || "";

    if (externalId.startsWith("enreach-")) {
      await supabase.from("sales").update({
        enrichment_status: "skipped",
        enrichment_error: "no_lead_identifier",
        enrichment_attempts: (sale.enrichment_attempts || 0) + 1,
        enrichment_last_attempt: new Date().toISOString(),
      }).eq("id", sale.id);
      skipped++;
      continue;
    }

    try {
      const url = `${apiUrl}/simpleleads?UniqueId=${externalId}`;
      const response = await fetch(url, {
        headers: { Authorization: authHeader, "X-Rate-Limit-Fair-Use-Policy": "Minute rated" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const leads = Array.isArray(data) ? data : data.data || data.results || [];

      if (leads.length === 0) {
        throw new Error("No lead data returned from API");
      }

      const leadData = leads[0];
      const rawPayload = sale.raw_payload || {};
      const updatedPayload = {
        ...rawPayload,
        data: leadData,
      };

      await supabase.from("sales").update({
        raw_payload: updatedPayload,
        enrichment_status: "healed",
        enrichment_error: null,
        enrichment_attempts: (sale.enrichment_attempts || 0) + 1,
        enrichment_last_attempt: new Date().toISOString(),
      }).eq("id", sale.id);

      healed++;
      log(`Healed Enreach sale ${externalId}`);

      await new Promise(r => setTimeout(r, turboMode ? 300 : 500));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await supabase.from("sales").update({
        enrichment_status: "failed",
        enrichment_error: errMsg,
        enrichment_attempts: (sale.enrichment_attempts || 0) + 1,
        enrichment_last_attempt: new Date().toISOString(),
      }).eq("id", sale.id);
      failed++;
      log(`Failed to heal Enreach sale ${externalId}: ${errMsg}`);
    }
  }

  return { healed, failed, skipped };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const turboMode = body.turboMode === true;
    const maxBatch = body.maxBatch || (turboMode ? 80 : 20);
    const saleExternalId = typeof body.saleExternalId === "string" ? body.saleExternalId.trim() : "";
    const providerFilter = typeof body.provider === "string" ? body.provider.trim() : "";
    const integrationIdFilter = typeof body.integrationId === "string" ? body.integrationId.trim() : "";
    const clientIdFilter = typeof body.clientId === "string" ? body.clientId.trim() : "";
    const supabase = getSupabase();
    const logs: string[] = [];
    const log = (msg: string) => {
      console.log(`[enrichment-healer] ${msg}`);
      logs.push(msg);
    };

    log(`Starting enrichment healer (maxBatch=${maxBatch}, turbo=${turboMode}, saleExternalId=${saleExternalId || "none"})`);

    // Fetch sales needing healing – include source for grouping by integration
    let salesQuery = supabase
      .from("sales")
      .select("id, adversus_external_id, integration_type, source, raw_payload, enrichment_status, enrichment_attempts, customer_phone")
      .order("sale_datetime", { ascending: false })
      .limit(maxBatch);

    if (saleExternalId) {
      salesQuery = salesQuery.eq("adversus_external_id", saleExternalId);
    } else {
      salesQuery = salesQuery
        .or("enrichment_status.in.(pending,failed),and(enrichment_status.eq.complete,or(customer_phone.is.null,customer_phone.eq.))")
        .lt("enrichment_attempts", 5);
    }

    if (providerFilter) {
      salesQuery = salesQuery.eq("integration_type", providerFilter);
    }

    if (clientIdFilter) {
      salesQuery = salesQuery.eq("client_campaign_id", clientIdFilter);
    }

    const { data: pendingSales, error } = await salesQuery;

    if (error) throw error;

    if (!pendingSales || pendingSales.length === 0) {
      log("No sales need healing");
      return new Response(JSON.stringify({ success: true, healed: 0, failed: 0, skipped: 0, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`Found ${pendingSales.length} sales needing healing`);

    // Group sales by source (= integration name) instead of integration_type
    const salesBySource: Record<string, any[]> = {};
    for (const sale of pendingSales) {
      const source = sale.source || sale.integration_type || "unknown";
      if (!salesBySource[source]) salesBySource[source] = [];
      salesBySource[source].push(sale);
    }

    let totalHealed = 0, totalFailed = 0, totalSkipped = 0;

    // Process each source group with its own credentials
    for (const [source, sales] of Object.entries(salesBySource)) {
      const integType = sales[0].integration_type || "";
      const provider = integType.toLowerCase();

      // Check budget for provider
      const budgetConfig = HEALER_BUDGETS[provider];
      if (budgetConfig) {
        const budget = turboMode ? budgetConfig.turbo : budgetConfig.normal;
        const usage = await getProviderUsage(supabase, provider);
        const maxCapacity = provider === "adversus" ? 1000 : 10000;
        if (usage >= (maxCapacity - budget)) {
          log(`${provider} budget exhausted (${usage}/${maxCapacity}, budget=${budget}), skipping ${sales.length} ${source} sales`);
          totalSkipped += sales.length;
          continue;
        }
      }

      // Fetch credentials for this specific integration by name (source)
      const creds = await getCredentialsByName(supabase, source);
      if (!creds) {
        log(`No active integration found for source "${source}", skipping ${sales.length} sales`);
        totalSkipped += sales.length;
        continue;
      }

      log(`Processing ${sales.length} sales from source "${source}" (provider: ${creds.integration.provider})`);

      let result: { healed: number; failed: number; skipped: number };
      if (creds.integration.provider === "adversus") {
        result = await healAdversus(supabase, sales, creds.credentials, log, turboMode);
      } else if (creds.integration.provider === "enreach") {
        result = await healEnreach(supabase, sales, creds.credentials, creds.integration, log, turboMode);
      } else {
        log(`Unknown provider "${creds.integration.provider}" for source "${source}", skipping`);
        totalSkipped += sales.length;
        continue;
      }

      totalHealed += result.healed;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
    }

    // Log summary
    await supabase.from("integration_logs").insert({
      integration_type: "healer",
      integration_name: "enrichment-healer",
      status: totalFailed > 0 ? "partial" : "success",
      message: `Healed: ${totalHealed}, Failed: ${totalFailed}, Skipped: ${totalSkipped}`,
      details: { totalHealed, totalFailed, totalSkipped, sources: Object.keys(salesBySource) },
    });

    log(`Done: healed=${totalHealed}, failed=${totalFailed}, skipped=${totalSkipped}`);

    return new Response(JSON.stringify({
      success: true,
      healed: totalHealed,
      failed: totalFailed,
      skipped: totalSkipped,
      logs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : (typeof error === "object" ? JSON.stringify(error) : String(error));
    console.error("[enrichment-healer] Error:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
