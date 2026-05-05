
-- 1. Tilføj kanonisk ID til alle regler der har dublet-ID (hvis ikke allerede til stede)
UPDATE product_pricing_rules
SET campaign_mapping_ids = array_append(
  campaign_mapping_ids, 
  'f1d4b4fc-b033-48c3-bb2e-e4138ea02556'::uuid
)
WHERE 'cccc28bb-8576-45e5-b219-f177d81a90e3'::uuid = ANY(campaign_mapping_ids)
  AND NOT ('f1d4b4fc-b033-48c3-bb2e-e4138ea02556'::uuid = ANY(campaign_mapping_ids));

-- 2. Fjern dublet-ID fra alle regler
UPDATE product_pricing_rules
SET campaign_mapping_ids = array_remove(
  campaign_mapping_ids, 
  'cccc28bb-8576-45e5-b219-f177d81a90e3'::uuid
)
WHERE 'cccc28bb-8576-45e5-b219-f177d81a90e3'::uuid = ANY(campaign_mapping_ids);

-- 3. Arkivér dubletten (bevar historik — princip §1)
UPDATE adversus_campaign_mappings
SET adversus_campaign_name = '[ARKIVERET] Winback 15 mdr.'
WHERE id = 'cccc28bb-8576-45e5-b219-f177d81a90e3';
