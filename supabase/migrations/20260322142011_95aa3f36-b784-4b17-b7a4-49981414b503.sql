
-- Add a healing function that can be called periodically or on-demand
-- to backfill any FM sales missing sale_items
CREATE OR REPLACE FUNCTION public.heal_fm_missing_sale_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_healed INTEGER := 0;
BEGIN
  INSERT INTO sale_items (sale_id, product_id, quantity, adversus_product_title, mapped_commission, mapped_revenue)
  SELECT DISTINCT ON (s.id)
    s.id,
    p.id,
    1,
    s.raw_payload->>'fm_product_name',
    COALESCE(ppr.commission_dkk, p.commission_dkk, 0),
    COALESCE(ppr.revenue_dkk, p.revenue_dkk, 0)
  FROM sales s
  LEFT JOIN sale_items si ON si.sale_id = s.id
  JOIN products p ON LOWER(TRIM(p.name)) = LOWER(TRIM(s.raw_payload->>'fm_product_name')) AND p.is_active = true
  LEFT JOIN adversus_campaign_mappings acm ON acm.client_campaign_id = s.client_campaign_id
  LEFT JOIN product_pricing_rules ppr ON ppr.product_id = p.id 
    AND ppr.is_active = true 
    AND acm.id = ANY(ppr.campaign_mapping_ids)
  WHERE s.source = 'fieldmarketing' 
    AND si.id IS NULL
    AND s.raw_payload->>'fm_product_name' IS NOT NULL
  ORDER BY s.id, ppr.priority DESC NULLS LAST, p.priority DESC NULLS LAST, p.created_at DESC;

  GET DIAGNOSTICS v_healed = ROW_COUNT;

  IF v_healed > 0 THEN
    INSERT INTO integration_logs (provider, event_type, status, message, payload)
    VALUES ('fieldmarketing', 'sale_item_healing', 'success',
            'Healed ' || v_healed || ' missing FM sale_items',
            jsonb_build_object('healed_count', v_healed, 'healed_at', now()));
  END IF;

  RETURN v_healed;
END;
$function$;
