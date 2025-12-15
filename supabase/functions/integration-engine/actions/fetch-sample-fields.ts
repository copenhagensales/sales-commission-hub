import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getAdapter } from "../adapters/registry.ts"

export async function fetchSampleFields(
  supabase: SupabaseClient,
  source: string | undefined,
  campaignId: string
) {
  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY")
  const { data: integrations, error: intError } = await supabase
    .from("dialer_integrations")
    .select("*")
    .eq("provider", source || "adversus")
    .eq("is_active", true)
    .limit(1)
  if (intError) throw intError
  if (!integrations || integrations.length === 0) {
    return { success: false, fields: [], leadCount: 0, message: "No active integration found" }
  }
  const integration = integrations[0]
  const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
    p_integration_id: integration.id,
    p_encryption_key: encryptionKey,
  })
  const adapter = getAdapter("adversus", credentials, integration.name, integration.api_url, integration.config)
  const leads = await (adapter as any).fetchLeadsForCampaign?.(campaignId, 100)
  if (!leads || leads.length === 0) {
    return {
      success: true,
      fields: [],
      leadCount: 0,
      message: `No leads found for campaign ${campaignId}`,
    }
  }
  const fields: { fieldId: string; label: string; sampleValue: string }[] = []
  const sampleLead = leads.find((l: any) => l.resultData && l.resultData.length > 0) || leads[0]
  const resultData = sampleLead?.resultData || []
  if (Array.isArray(resultData)) {
    for (const field of resultData) {
      if (field.id !== undefined) {
        fields.push({
          fieldId: `result_${field.id}`,
          label: `Field ${field.id}`,
          sampleValue:
            field.value !== null && field.value !== undefined ? String(field.value) : "(empty)",
        })
      }
    }
  }
  fields.sort((a, b) => a.fieldId.localeCompare(b.fieldId))
  return {
    success: true,
    fields,
    leadCount: leads.length,
    sampleLeadId: sampleLead?.id,
  }
}

