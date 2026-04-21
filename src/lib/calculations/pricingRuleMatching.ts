/**
 * Shared helper: decide whether a pricing rule matches a given campaign.
 *
 * Logic:
 *   - If campaign_mapping_ids is null/empty → universal rule, always matches.
 *   - mode === 'include' (default) → match only when campaignId ∈ ids.
 *   - mode === 'exclude'           → match only when campaignId ∉ ids.
 *
 * If `campaignId` is null/undefined for a non-universal rule:
 *   - include mode → no match (rule requires a specific campaign).
 *   - exclude mode → match (sale is not in any of the excluded campaigns).
 */
export type CampaignMatchMode = "include" | "exclude";

export function ruleMatchesCampaign(
  campaignMappingIds: string[] | null | undefined,
  mode: CampaignMatchMode | null | undefined,
  campaignId: string | null | undefined,
): boolean {
  if (!campaignMappingIds || campaignMappingIds.length === 0) return true;
  const effectiveMode: CampaignMatchMode = mode === "exclude" ? "exclude" : "include";
  if (effectiveMode === "include") {
    return !!campaignId && campaignMappingIds.includes(campaignId);
  }
  // exclude
  if (!campaignId) return true;
  return !campaignMappingIds.includes(campaignId);
}
