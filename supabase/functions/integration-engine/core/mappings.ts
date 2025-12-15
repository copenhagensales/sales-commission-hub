import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { CampaignMappingConfig, ReferenceExtractionConfig } from "../types.ts"

export async function getCampaignMappings(
  supabase: SupabaseClient
): Promise<CampaignMappingConfig[]> {
  const { data: mappings } = await supabase
    .from("adversus_campaign_mappings")
    .select("adversus_campaign_id, client_campaign_id, reference_extraction_config")

  if (!mappings) return []

  return mappings.map((m: any) => ({
    adversusCampaignId: m.adversus_campaign_id,
    clientCampaignId: m.client_campaign_id,
    referenceConfig: m.reference_extraction_config as ReferenceExtractionConfig | null,
  }))
}

