-- Change campaign_mapping_id to campaign_mapping_ids array
ALTER TABLE product_pricing_rules 
  DROP COLUMN IF EXISTS campaign_mapping_id;

ALTER TABLE product_pricing_rules 
  ADD COLUMN campaign_mapping_ids UUID[] DEFAULT NULL;