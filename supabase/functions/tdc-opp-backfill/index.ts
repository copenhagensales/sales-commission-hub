import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DELAY_MS = 1050; // ~57 req/min, safely under 60/min limit
const DEFAULT_BATCH = 50;

// TDC Erhverv client_campaigns ID
const TDC_ERHVERV_CAMPAIGN_IDS = ["374ce55d-5b01-41b9-a009-aad5f0feb288"];

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getCredentials(supabase: any): Promise<{ authHeader: string } | null> {
  const { data: integrations } = await supabase
    .from("dialer_integrations")
    .select("id, name, provider")
    .eq("is_active", true)
    .ilike("name", "Lovablecph");

  if (!integrations || integrations.length === 0) return null;

  const integration = integrations[0];
  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");

  const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
    p_integration_id: integration.id,
    p_encryption_key: encryptionKey,
  });

  const user = credentials?.username || credentials?.ADVERSUS_API_USERNAME;
  const pass = credentials?.password || credentials?.ADVERSUS_API_PASSWORD;
  if (!user || !pass) return null;

  return { authHeader: "Basic " + btoa(`${user}:${pass}`) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || DEFAULT_BATCH;
    const autoRun = body.autoRun === true;
    const supabase = getSupabase();
    const logs: string[] = [];
    const log = (msg: string) => { console.log(`[tdc-opp-backfill] ${msg}`); logs.push(msg); };

    // 1. Get Adversus credentials for Lovablecph
    const creds = await getCredentials(supabase);
    if (!creds) {
      return new Response(JSON.stringify({ error: "No Lovablecph credentials found" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Find TDC Erhverv sales missing leadResultFields
    // Sales that have a leadId but no/empty leadResultFields in raw_payload
    const { data: sales, error } = await supabase
      .from("sales")
      .select("id, adversus_external_id, raw_payload, customer_phone")
      .eq("source", "Lovablecph")
      .in("client_campaign_id", TDC_ERHVERV_CAMPAIGN_IDS)
      .not("raw_payload", "is", null)
      .eq("enrichment_status", "pending")
      .order("sale_datetime", { ascending: false })
      .limit(batchSize);

    if (error) throw error;

    // Filter in-memory: only those missing leadResultFields or with empty object
    const needsHealing = (sales || []).filter((s: any) => {
      const payload = s.raw_payload || {};
      const leadId = payload.leadId || payload.metadata?.leadId;
      if (!leadId) return false;
      const fields = payload.leadResultFields;
      if (!fields || (typeof fields === "object" && Object.keys(fields).length === 0)) return true;
      return false;
    });

    if (needsHealing.length === 0) {
      log("No more TDC Erhverv sales need OPP backfill — done!");
      return new Response(JSON.stringify({ success: true, processed: 0, remaining: 0, done: true, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Count total remaining (for progress)
    const { count: totalRemaining } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("source", "Lovablecph")
      .in("client_campaign_id", TDC_ERHVERV_CAMPAIGN_IDS)
      .not("raw_payload", "is", null)
      .eq("enrichment_status", "pending");

    log(`Starting batch: ${needsHealing.length} sales to process (est. total remaining: ~${totalRemaining})`);

    let processed = 0, skipped = 0, failed = 0;

    for (const sale of needsHealing) {
      const leadId = sale.raw_payload.leadId || sale.raw_payload.metadata?.leadId;

      try {
        const response = await fetch(`https://api.adversus.io/v1/leads/${leadId}`, {
          headers: { Authorization: creds.authHeader },
        });

        if (response.status === 429) {
          log(`Rate limited at sale ${sale.adversus_external_id}, stopping batch early`);
          break;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const leadData = await response.json();
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

        if (leadResultData.length === 0 && Object.keys(leadResultFields).length === 0) {
          throw new Error("API returned empty lead data");
        }

        const phone = leadData.phone || leadData.contactPhone || leadData.mobile || null;

        const updatedPayload = {
          ...sale.raw_payload,
          leadResultFields,
          leadResultData,
        };

        await supabase.from("sales").update({
          raw_payload: updatedPayload,
          enrichment_status: "healed",
          enrichment_error: null,
          enrichment_last_attempt: new Date().toISOString(),
          ...(phone && !sale.customer_phone ? { customer_phone: phone } : {}),
        }).eq("id", sale.id);

        processed++;
        if (processed % 10 === 0) log(`Progress: ${processed}/${needsHealing.length}`);

        await new Promise(r => setTimeout(r, DELAY_MS));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await supabase.from("sales").update({
          enrichment_status: "failed",
          enrichment_error: `backfill: ${errMsg}`,
          enrichment_last_attempt: new Date().toISOString(),
        }).eq("id", sale.id);
        failed++;
        log(`Failed sale ${sale.adversus_external_id} (lead ${leadId}): ${errMsg}`);
      }
    }

    const remaining = (totalRemaining || 0) - processed;
    const done = needsHealing.length < batchSize && failed === 0;

    log(`Batch done: processed=${processed}, failed=${failed}, skipped=${skipped}, remaining≈${remaining}, done=${done}`);

    // Log to integration_logs
    await supabase.from("integration_logs").insert({
      integration_type: "backfill",
      integration_name: "tdc-opp-backfill",
      status: failed > 0 ? "partial" : "success",
      message: `Processed: ${processed}, Failed: ${failed}, Remaining: ~${remaining}`,
      details: { processed, failed, skipped, remaining, done },
    });

    // 4. Auto-continue if enabled and not done
    if (autoRun && !done && processed > 0) {
      log("Auto-continuing in 5s...");
      const selfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tdc-opp-backfill`;
      // Fire-and-forget: trigger next batch after 5s delay
      setTimeout(async () => {
        try {
          await fetch(selfUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({ batchSize, autoRun: true }),
          });
        } catch (e) {
          console.error("[tdc-opp-backfill] Auto-continue failed:", e);
        }
      }, 5000);
    }

    return new Response(JSON.stringify({
      success: true, processed, failed, skipped, remaining, done, logs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[tdc-opp-backfill] Error:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
