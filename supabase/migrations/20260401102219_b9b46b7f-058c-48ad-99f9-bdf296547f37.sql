
-- Remove incorrect Eesy TM mappings: campaigns that don't contain "eesy" in the name
-- These were added by the default-client auto-assign fallback
UPDATE adversus_campaign_mappings acm
SET client_campaign_id = NULL
FROM client_campaigns cc
WHERE acm.client_campaign_id = cc.id
  AND cc.client_id = '81993a7b-ff24-46b8-8ffb-37a83138ddba'
  AND (acm.adversus_campaign_name NOT ILIKE '%eesy%' OR acm.adversus_campaign_name IS NULL);
