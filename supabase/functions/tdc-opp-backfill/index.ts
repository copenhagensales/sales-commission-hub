import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TDC_ERHVERV_CAMPAIGN_IDS = ["374ce55d-5b01-41b9-a009-aad5f0feb288"];
// Adversus campaign IDs for TDC Erhverv (numeric IDs used in the Adversus API)
const ADVERSUS_CAMPAIGN_IDS = [99496, 92498];

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

/** Check if a sale already has OPP data in its raw_payload */
function hasOppData(rawPayload: any): boolean {
  if (!rawPayload) return false;
  const fields = rawPayload.leadResultFields;
  if (fields && typeof fields === "object") {
    if (fields["OPP nr"] || fields["OPP-nr"]) return true;
  }
  const resultData = rawPayload.leadResultData;
  if (Array.isArray(resultData)) {
    for (const item of resultData) {
      const label = item?.label || item?.name;
      if (label === "OPP nr" || label === "OPP-nr") return true;
    }
  }
  return false;
}

/** Fetch leads from Adversus bulk endpoint for a given campaign */
async function fetchLeadsBulk(
  authHeader: string,
  adversusCampaignId: number,
  pageSize = 500
): Promise<any[]> {
  const allLeads: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 50) {
    const filters = JSON.stringify({ campaignId: { "$eq": adversusCampaignId } });
    const url = `https://api.adversus.io/leads?filters=${encodeURIComponent(filters)}&pageSize=${pageSize}&page=${page}`;

    const res = await fetch(url, {
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    if (res.status === 429) {
      console.log(`[tdc-opp-backfill] Rate limited on page ${page}, waiting 10s...`);
      await new Promise(r => setTimeout(r, 10000));
      continue; // retry same page
    }

    if (!res.ok) {
      console.log(`[tdc-opp-backfill] Failed to fetch leads page ${page}: ${res.status}`);
      break;
    }

    const data = await res.json();
    const pageLeads = data.leads || data || [];

    if (pageLeads.length === 0) {
      hasMore = false;
    } else {
      allLeads.push(...pageLeads);
      console.log(`[tdc-opp-backfill] Campaign ${adversusCampaignId} page ${page}: ${pageLeads.length} leads (total: ${allLeads.length})`);
      if (pageLeads.length < pageSize) {
        hasMore = false;
      } else {
        page++;
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  return allLeads;
}

/** Extract resultData fields from a lead into a map */
function extractResultFields(lead: any): { leadResultData: any[]; leadResultFields: Record<string, any> } {
  const resultData = lead.resultData || lead.leadResultData || [];
  const fields: Record<string, any> = {};

  if (Array.isArray(resultData)) {
    for (const field of resultData) {
      const fieldName = field?.name || field?.label;
      if (field && fieldName !== undefined) {
        fields[fieldName] = field.value;
      }
    }
  }

  return { leadResultData: resultData, leadResultFields: fields };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getSupabase();
    const logs: string[] = [];
    const log = (msg: string) => { console.log(`[tdc-opp-backfill] ${msg}`); logs.push(msg); };

    const creds = await getCredentials(supabase);
    if (!creds) {
      return new Response(JSON.stringify({ error: "No Lovablecph credentials found" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Pre-heal sales that already have OPP data but wrong status
    for (const status of ["pending", "failed"]) {
      const { data: candidates } = await supabase
        .from("sales")
        .select("id, raw_payload")
        .eq("source", "Lovablecph")
        .in("client_campaign_id", TDC_ERHVERV_CAMPAIGN_IDS)
        .eq("enrichment_status", status)
        .not("raw_payload", "is", null)
        .gte("sale_datetime", "2026-01-01")
        .limit(1000);

      const alreadyHealedIds = (candidates || [])
        .filter((s: any) => hasOppData(s.raw_payload))
        .map((s: any) => s.id);

      if (alreadyHealedIds.length > 0) {
        for (let i = 0; i < alreadyHealedIds.length; i += 50) {
          const chunk = alreadyHealedIds.slice(i, i + 50);
          await supabase.from("sales").update({
            enrichment_status: "healed",
            enrichment_error: null,
            enrichment_last_attempt: new Date().toISOString(),
          }).in("id", chunk);
        }
        log(`Pre-healed ${alreadyHealedIds.length} ${status} sales (already had OPP data)`);
      }
    }

    // Step 2: Get all missing sales (2026, Lovablecph, TDC Erhverv, no OPP)
    const { data: missingSales, error } = await supabase
      .from("sales")
      .select("id, adversus_external_id, raw_payload, customer_phone")
      .eq("source", "Lovablecph")
      .in("client_campaign_id", TDC_ERHVERV_CAMPAIGN_IDS)
      .not("raw_payload", "is", null)
      .in("enrichment_status", ["pending", "failed"])
      .gte("sale_datetime", "2026-01-01")
      .order("sale_datetime", { ascending: false })
      .limit(1000);

    if (error) throw error;

    // Filter to only those truly missing OPP
    const needsHealing = (missingSales || []).filter((s: any) => !hasOppData(s.raw_payload));

    if (needsHealing.length === 0) {
      log("No more TDC Erhverv sales need OPP backfill — done!");
      return new Response(JSON.stringify({ success: true, processed: 0, remaining: 0, done: true, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`Found ${needsHealing.length} sales needing OPP data. Fetching leads from Adversus bulk API...`);

    // Step 3: Build leadId -> sale mapping
    const leadIdToSales = new Map<string, any[]>();
    for (const sale of needsHealing) {
      const leadId = String(sale.raw_payload?.leadId || sale.raw_payload?.metadata?.leadId || "");
      if (leadId) {
        if (!leadIdToSales.has(leadId)) leadIdToSales.set(leadId, []);
        leadIdToSales.get(leadId)!.push(sale);
      }
    }

    log(`${leadIdToSales.size} unique leadIds to match from ${needsHealing.length} sales`);

    // Step 4: Fetch leads in bulk from Adversus for each campaign
    const leadIdToData = new Map<string, { leadResultData: any[]; leadResultFields: Record<string, any>; phone?: string }>();

    for (const campaignId of ADVERSUS_CAMPAIGN_IDS) {
      log(`Fetching leads for Adversus campaign ${campaignId}...`);
      const leads = await fetchLeadsBulk(creds.authHeader, campaignId, 500);
      log(`Got ${leads.length} leads from campaign ${campaignId}`);

      for (const lead of leads) {
        const leadId = String(lead.id || lead.leadId || "");
        if (leadId && leadIdToSales.has(leadId)) {
          const { leadResultData, leadResultFields } = extractResultFields(lead);
          const phone = lead.phone || lead.contactPhone || lead.mobile || null;
          leadIdToData.set(leadId, { leadResultData, leadResultFields, phone });
        }
      }
    }

    log(`Matched ${leadIdToData.size} leadIds out of ${leadIdToSales.size} needed`);

    // Step 5: Update matched sales
    let processed = 0;
    let noMatch = 0;

    for (const [leadId, sales] of leadIdToSales.entries()) {
      const leadData = leadIdToData.get(leadId);

      if (!leadData || (leadData.leadResultData.length === 0 && Object.keys(leadData.leadResultFields).length === 0)) {
        // No match or empty data
        for (const sale of sales) {
          await supabase.from("sales").update({
            enrichment_status: "failed",
            enrichment_error: "bulk_lead_lookup_no_opp_data",
            enrichment_last_attempt: new Date().toISOString(),
          }).eq("id", sale.id);
        }
        noMatch += sales.length;
        continue;
      }

      for (const sale of sales) {
        const updatedPayload = {
          ...sale.raw_payload,
          leadResultFields: leadData.leadResultFields,
          leadResultData: leadData.leadResultData,
        };

        await supabase.from("sales").update({
          raw_payload: updatedPayload,
          enrichment_status: "healed",
          enrichment_error: null,
          enrichment_last_attempt: new Date().toISOString(),
          ...(leadData.phone && !sale.customer_phone ? { customer_phone: leadData.phone } : {}),
        }).eq("id", sale.id);

        processed++;
      }
    }

    // Also handle sales without any leadId
    const noLeadIdSales = needsHealing.filter((s: any) => {
      const leadId = s.raw_payload?.leadId || s.raw_payload?.metadata?.leadId;
      return !leadId;
    });

    if (noLeadIdSales.length > 0) {
      log(`${noLeadIdSales.length} sales have no leadId — marking as no_lead_id`);
      for (const sale of noLeadIdSales) {
        await supabase.from("sales").update({
          enrichment_status: "failed",
          enrichment_error: "no_lead_id_in_payload",
          enrichment_last_attempt: new Date().toISOString(),
        }).eq("id", sale.id);
      }
    }

    const done = true;
    log(`Done: healed=${processed}, no_match=${noMatch}, no_lead_id=${noLeadIdSales.length}`);

    await supabase.from("integration_logs").insert({
      integration_type: "backfill",
      integration_name: "tdc-opp-backfill",
      status: noMatch > 0 ? "partial" : "success",
      message: `Healed: ${processed}, No match: ${noMatch}, No leadId: ${noLeadIdSales.length}`,
      details: { processed, noMatch, noLeadId: noLeadIdSales.length, done },
    });

    return new Response(JSON.stringify({
      success: true, processed, noMatch, noLeadId: noLeadIdSales.length, done, logs,
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
