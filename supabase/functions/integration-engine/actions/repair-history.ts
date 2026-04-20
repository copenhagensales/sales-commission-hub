import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { IngestionEngine } from "../core.ts"
import { getAdapter } from "../adapters/registry.ts"

const MAX_RECORDS = 50
const BATCH_SIZE = 25

export async function repairHistory(
  supabase: SupabaseClient,
  days: number,
  integrationId?: string,
  maxRecords?: number
) {
  const recordLimit = maxRecords ?? MAX_RECORDS
  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY")
  let query = supabase.from("dialer_integrations").select("*").eq("is_active", true)
  if (integrationId) {
    query = query.eq("id", integrationId)
  } else {
    query = query.eq("provider", "adversus")
  }
  const { data: integrations, error: intError } = await query
  if (intError) throw intError
  if (!integrations || integrations.length === 0) {
    return {
      totalProcessed: 0,
      totalErrors: 0,
      results: [],
      message: integrationId ? "Integration not found or inactive" : "No active Adversus integrations found",
    }
  }
  const engine = new IngestionEngine()
  const campaignMappings = await engine.getCampaignMappings()
  let totalProcessed = 0
  let totalErrors = 0
  const results: { name: string; status: string; processed?: number; errors?: number; error?: string; limited?: boolean }[] = []
  for (const integration of integrations!) {
    try {
      const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
        p_integration_id: integration.id,
        p_encryption_key: encryptionKey,
      })
      const adapter = await getAdapter(
        integration.provider,
        credentials,
        integration.name,
        integration.api_url,
        integration.config,
        integration.calls_org_codes
      )
      let sales = await adapter.fetchSales(days || 90, campaignMappings)
      const wasLimited = sales.length > recordLimit
      if (wasLimited) {
        console.log(`[repair-history] ${integration.name}: Limiting from ${sales.length} to ${recordLimit} records`)
        sales = sales.slice(0, recordLimit)
      }
      
      // Process in batches to avoid CPU timeout
      let batchProcessed = 0
      let batchErrors = 0
      for (let i = 0; i < sales.length; i += BATCH_SIZE) {
        const batch = sales.slice(i, i + BATCH_SIZE)
        const result = await engine.processSales(batch)
        batchProcessed += result.processed
        batchErrors += result.errors
      }
      
      totalProcessed += batchProcessed
      totalErrors += batchErrors
      results.push({
        name: integration.name,
        status: "success",
        processed: batchProcessed,
        errors: batchErrors,
        limited: wasLimited,
      })
      await supabase.from("integration_logs").insert({
        integration_type: "dialer",
        integration_id: integration.id,
        integration_name: integration.name,
        status: "success",
        message: `Historical repair: ${batchProcessed} sales processed${wasLimited ? ` (limited to ${recordLimit})` : ""}`,
        details: { action: "repair-history", days, processed: batchProcessed, errors: batchErrors, limited: wasLimited },
      })
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      totalErrors++
      results.push({ name: integration.name, status: "error", error: errMsg })
      await supabase.from("integration_logs").insert({
        integration_type: "dialer",
        integration_id: integration.id,
        integration_name: integration.name,
        status: "error",
        message: `Historical repair failed: ${errMsg}`,
        details: { action: "repair-history", days, error: errMsg },
      })
    }
  }
  return { totalProcessed, totalErrors, results, maxRecords: recordLimit }
}

