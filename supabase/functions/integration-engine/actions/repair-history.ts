import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { IngestionEngine } from "../core.ts"
import { getAdapter } from "../adapters/registry.ts"

export async function repairHistory(
  supabase: SupabaseClient,
  days: number,
  integrationId?: string
) {
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
  const results: { name: string; status: string; processed?: number; errors?: number; error?: string }[] = []
  for (const integration of integrations!) {
    try {
      const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
        p_integration_id: integration.id,
        p_encryption_key: encryptionKey,
      })
      const adapter = getAdapter(
        "adversus",
        credentials,
        integration.name,
        integration.api_url,
        integration.config
      )
      const sales = await adapter.fetchSales(days || 90, campaignMappings)
      const result = await engine.processSales(sales)
      totalProcessed += result.processed
      totalErrors += result.errors
      results.push({
        name: integration.name,
        status: "success",
        processed: result.processed,
        errors: result.errors,
      })
      await supabase.from("integration_logs").insert({
        integration_type: "dialer",
        integration_id: integration.id,
        integration_name: integration.name,
        status: "success",
        message: `Historical repair: ${result.processed} sales processed`,
        details: { action: "repair-history", days, processed: result.processed, errors: result.errors },
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
  return { totalProcessed, totalErrors, results }
}

