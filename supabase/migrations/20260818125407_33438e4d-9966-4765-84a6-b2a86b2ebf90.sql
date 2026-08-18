DROP FUNCTION IF EXISTS public.heal_fm_missing_sale_items();

CREATE OR REPLACE FUNCTION public.heal_fm_missing_sale_items(p_sale_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_healed INTEGER := 0;
BEGIN
  INSERT INTO sale_items (sale_id, product_id, quantity, adversus_product_title, display_name, mapped_commission, mapped_revenue)
  SELECT DISTINCT ON (s.id)
    s.id,
    p.id,
    1,
    s.raw_payload->>'fm_product_name',
    p.name,
    COALESCE(ppr.commission_dkk, ppr_uni.commission_dkk, p.commission_dkk, 0),
    COALESCE(ppr.revenue_dkk, ppr_uni.revenue_dkk, p.revenue_dkk, 0)
  FROM sales s
  LEFT JOIN sale_items si ON si.sale_id = s.id
  JOIN products p ON LOWER(TRIM(p.name)) = LOWER(TRIM(s.raw_payload->>'fm_product_name')) AND p.is_active = true
  LEFT JOIN adversus_campaign_mappings acm ON acm.client_campaign_id = s.client_campaign_id
  LEFT JOIN product_pricing_rules ppr ON ppr.product_id = p.id
    AND ppr.is_active = true
    AND acm.id = ANY(ppr.campaign_mapping_ids)
  LEFT JOIN product_pricing_rules ppr_uni ON ppr_uni.product_id = p.id
    AND ppr_uni.is_active = true
    AND (ppr_uni.campaign_mapping_ids IS NULL OR ppr_uni.campaign_mapping_ids = '{}')
  WHERE s.source = 'fieldmarketing'
    AND si.id IS NULL
    AND s.raw_payload->>'fm_product_name' IS NOT NULL
    AND (p_sale_ids IS NULL OR s.id = ANY(p_sale_ids))
  ORDER BY s.id, ppr.priority DESC NULLS LAST, ppr_uni.priority DESC NULLS LAST, p.priority DESC NULLS LAST, p.created_at DESC;

  GET DIAGNOSTICS v_healed = ROW_COUNT;

  IF v_healed > 0 THEN
    INSERT INTO integration_logs (integration_type, integration_name, status, message, details)
    VALUES ('fieldmarketing', 'sale_item_healing', 'success',
            'Healed ' || v_healed || ' missing FM sale_items',
            jsonb_build_object('healed_count', v_healed, 'healed_at', now(), 'sale_ids', p_sale_ids));
  END IF;

  RETURN v_healed;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.heal_fm_missing_sale_items(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_fm_sale_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product_name text;
  v_product_id uuid;
  v_commission numeric;
  v_revenue numeric;
  v_display_name text;
  v_rule_commission numeric;
  v_rule_revenue numeric;
  v_campaign_mapping_id uuid;
BEGIN
  IF NEW.source != 'fieldmarketing' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM sale_items WHERE sale_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_product_name := NEW.raw_payload->>'fm_product_name';
  IF v_product_name IS NULL OR btrim(v_product_name) = '' THEN
    INSERT INTO integration_logs (integration_type, integration_name, status, message, details)
    VALUES ('fieldmarketing', 'sale_item_creation', 'warning',
            'No fm_product_name in raw_payload for sale ' || NEW.id,
            jsonb_build_object('sale_id', NEW.id));
    RETURN NEW;
  END IF;

  SELECT id, name, commission_dkk, revenue_dkk
  INTO v_product_id, v_display_name, v_commission, v_revenue
  FROM products
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_product_name))
    AND is_active = true
  ORDER BY priority DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

  IF v_product_id IS NULL THEN
    INSERT INTO integration_logs (integration_type, integration_name, status, message, details)
    VALUES ('fieldmarketing', 'sale_item_creation', 'warning',
            'Unmatched product name: ' || v_product_name || ' for sale ' || NEW.id,
            jsonb_build_object('sale_id', NEW.id, 'product_name', v_product_name));
    RETURN NEW;
  END IF;

  IF NEW.client_campaign_id IS NOT NULL THEN
    SELECT id INTO v_campaign_mapping_id
    FROM adversus_campaign_mappings
    WHERE client_campaign_id = NEW.client_campaign_id
    LIMIT 1;
  END IF;

  IF v_campaign_mapping_id IS NOT NULL THEN
    SELECT commission_dkk, revenue_dkk
    INTO v_rule_commission, v_rule_revenue
    FROM product_pricing_rules
    WHERE product_id = v_product_id
      AND is_active = true
      AND v_campaign_mapping_id = ANY(campaign_mapping_ids)
    ORDER BY priority DESC NULLS LAST, created_at DESC, id DESC
    LIMIT 1;
  END IF;

  IF v_rule_commission IS NULL THEN
    SELECT commission_dkk, revenue_dkk
    INTO v_rule_commission, v_rule_revenue
    FROM product_pricing_rules
    WHERE product_id = v_product_id
      AND is_active = true
      AND (campaign_mapping_ids IS NULL OR campaign_mapping_ids = '{}')
    ORDER BY priority DESC NULLS LAST, created_at DESC, id DESC
    LIMIT 1;
  END IF;

  IF v_rule_commission IS NOT NULL THEN
    v_commission := v_rule_commission;
  END IF;
  IF v_rule_revenue IS NOT NULL THEN
    v_revenue := v_rule_revenue;
  END IF;

  INSERT INTO sale_items (sale_id, product_id, mapped_commission, mapped_revenue, display_name, adversus_product_title, quantity)
  VALUES (NEW.id, v_product_id, COALESCE(v_commission, 0), COALESCE(v_revenue, 0), v_display_name, v_product_name, 1)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;