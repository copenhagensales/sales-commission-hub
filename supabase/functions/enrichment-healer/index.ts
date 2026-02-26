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
 * Provider budget limits for healer (15% of hourly capacity)
 */
const HEALER_BUDGETS: Record<string, number> = {
  adversus: 150,  // 15% of 1000
  enreach: 1500,  // 15% of 10000
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
 * Get decrypted credentials for a provider's first active integration
 */
async function getProviderCredentials(supabase: any, provider: string): Promise<{ credentials: any; integration: any } | null> {
  const { data: integrations } = await supabase
    .from("dialer_integrations")
    .select("id, name, provider, api_url, config")
    .eq("provider", provider)
    .eq("is_active", true)
    .limit(1);

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
  log: (msg: string) => void
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

      const leadData = await response.json();
      const leadResultData = leadData.resultData || leadData.leadResultData || [];

      // Build leadResultFields from resultData array (same logic as integration-engine adapter)
      const leadResultFields: Record<string, any> = {};
      if (Array.isArray(leadResultData)) {
        for (const field of leadResultData) {
          const fieldName = field?.name || field?.label;
          if (field && fieldName !== undefined) {
            leadResultFields[fieldName] = field.value;
          }
        }
      }

      // Only mark as healed if we actually got data
      if (leadResultData.length === 0 && Object.keys(leadResultFields).length === 0) {
        throw new Error("API returned empty lead data");
      }

      // Update sale with enriched data
      const updatedPayload = {
        ...rawPayload,
        leadResultFields,
        leadResultData,
      };

      await supabase.from("sales").update({
        raw_payload: updatedPayload,
        enrichment_status: "healed",
        enrichment_error: null,
        enrichment_attempts: (sale.enrichment_attempts || 0) + 1,
        enrichment_last_attempt: new Date().toISOString(),
      }).eq("id", sale.id);

      healed++;
      log(`Healed Adversus sale ${sale.adversus_external_id} (lead ${leadId})`);

      // Small delay to respect rate limits
      await new Promise(r => setTimeout(r, 1500));
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
  log: (msg: string) => void
): Promise<{ healed: number; failed: number; skipped: number }> {
  let healed = 0, failed = 0, skipped = 0;

  const apiKey = credentials?.api_key || credentials?.apiKey;
  const apiUrl = integration?.api_url || credentials?.api_url || "https://api.herobase.com";
  if (!apiKey) {
    log("No Enreach API key found, skipping all");
    return { healed: 0, failed: 0, skipped: sales.length };
  }

  for (const sale of sales) {
    const externalId = sale.adversus_external_id || "";

    // Webhook-created sales have no lead ID to look up
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
        headers: { Authorization: `Bearer ${apiKey}`, "X-Rate-Limit-Fair-Use-Policy": "Minute rated" },
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

      await new Promise(r => setTimeout(r, 500));
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
    const maxBatch = body.maxBatch || 20;
    const saleExternalId = typeof body.saleExternalId === "string" ? body.saleExternalId.trim() : "";
    const providerFilter = typeof body.provider === "string" ? body.provider.trim() : "";
    const integrationIdFilter = typeof body.integrationId === "string" ? body.integrationId.trim() : "";
    const supabase = getSupabase();
    const logs: string[] = [];
    const log = (msg: string) => {
      console.log(`[enrichment-healer] ${msg}`);
      logs.push(msg);
    };

    log(`Starting enrichment healer (maxBatch=${maxBatch}, saleExternalId=${saleExternalId || "none"})`);

    // Fetch sales needing healing
    let salesQuery = supabase
      .from("sales")
      .select("id, adversus_external_id, integration_type, raw_payload, enrichment_status, enrichment_attempts")
      .order("sale_datetime", { ascending: false })
      .limit(maxBatch);

    if (saleExternalId) {
      salesQuery = salesQuery.eq("adversus_external_id", saleExternalId);
    } else {
      salesQuery = salesQuery
        .in("enrichment_status", ["pending", "failed"])
        .lt("enrichment_attempts", 5);
    }

    if (providerFilter) {
      salesQuery = salesQuery.eq("integration_type", providerFilter);
    }

    // integration_id column doesn't exist on sales table; filter by integration_type instead
    if (integrationIdFilter) {
      // Skip - integrationId filter not supported (no column)
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

    // Group by provider
    const adversusSales = pendingSales.filter((s: any) => s.integration_type === "adversus");
    const enreachSales = pendingSales.filter((s: any) => s.integration_type === "enreach");

    let totalHealed = 0, totalFailed = 0, totalSkipped = 0;

    // Heal Adversus sales
    if (adversusSales.length > 0) {
      const usage = await getProviderUsage(supabase, "adversus");
      const healerBudget = HEALER_BUDGETS.adversus;
      
      if (usage >= (1000 - healerBudget)) {
        log(`Adversus budget exhausted (${usage}/1000), skipping ${adversusSales.length} sales`);
        totalSkipped += adversusSales.length;
      } else {
        const creds = await getProviderCredentials(supabase, "adversus");
        if (creds) {
          const result = await healAdversus(supabase, adversusSales, creds.credentials, log);
          totalHealed += result.healed;
          totalFailed += result.failed;
          totalSkipped += result.skipped;
        }
      }
    }

    // Heal Enreach sales
    if (enreachSales.length > 0) {
      const usage = await getProviderUsage(supabase, "enreach");
      const healerBudget = HEALER_BUDGETS.enreach;
      
      if (usage >= (10000 - healerBudget)) {
        log(`Enreach budget exhausted (${usage}/10000), skipping ${enreachSales.length} sales`);
        totalSkipped += enreachSales.length;
      } else {
        const creds = await getProviderCredentials(supabase, "enreach");
        if (creds) {
          const result = await healEnreach(supabase, enreachSales, creds.credentials, creds.integration, log);
          totalHealed += result.healed;
          totalFailed += result.failed;
          totalSkipped += result.skipped;
        }
      }
    }

    // Log summary to integration_logs
    await supabase.from("integration_logs").insert({
      integration_type: "healer",
      integration_name: "enrichment-healer",
      status: totalFailed > 0 ? "partial" : "success",
      message: `Healed: ${totalHealed}, Failed: ${totalFailed}, Skipped: ${totalSkipped}`,
      details: { totalHealed, totalFailed, totalSkipped, adversus: adversusSales.length, enreach: enreachSales.length },
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
