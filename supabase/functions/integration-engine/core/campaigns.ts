import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { StandardCampaign } from "../types.ts"

export async function processCampaigns(
  supabase: SupabaseClient,
  campaigns: StandardCampaign[],
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  if (campaigns.length === 0) return { processed: 0, errors: 0 }
  log("INFO", `Procesando ${campaigns.length} campañas...`)

  let processed = 0
  let errors = 0

  for (const camp of campaigns) {
    try {
      const { data: existing } = await supabase
        .from("adversus_campaign_mappings")
        .select("id")
        .eq("adversus_campaign_id", camp.externalId)
        .maybeSingle()

      if (existing) {
        await supabase
          .from("adversus_campaign_mappings")
          .update({ adversus_campaign_name: camp.name })
          .eq("id", existing.id)
      } else {
        await supabase.from("adversus_campaign_mappings").insert({
          adversus_campaign_id: camp.externalId,
          adversus_campaign_name: camp.name,
        })
      }
      processed++
    } catch (e) {
      errors++
      const errMsg = e instanceof Error ? e.message : String(e)
      log("ERROR", `Error campaña ${camp.name}`, errMsg)
    }
  }
  return { processed, errors }
}

