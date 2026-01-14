-- Migrate existing product_campaign_overrides to product_pricing_rules
INSERT INTO public.product_pricing_rules (
  product_id,
  campaign_mapping_ids,
  conditions,
  commission_dkk,
  revenue_dkk,
  priority,
  is_active,
  name
)
SELECT 
  pco.product_id,
  ARRAY[pco.campaign_mapping_id],
  '{}'::jsonb,
  pco.commission_dkk,
  pco.revenue_dkk,
  0,
  true,
  NULL
FROM public.product_campaign_overrides pco
WHERE pco.product_id IS NOT NULL
  AND pco.campaign_mapping_id IS NOT NULL
  AND NOT EXISTS (
    -- Avoid duplicates if already migrated
    SELECT 1 FROM public.product_pricing_rules ppr
    WHERE ppr.product_id = pco.product_id
      AND ppr.campaign_mapping_ids @> ARRAY[pco.campaign_mapping_id]
      AND ppr.campaign_mapping_ids <@ ARRAY[pco.campaign_mapping_id]
  );