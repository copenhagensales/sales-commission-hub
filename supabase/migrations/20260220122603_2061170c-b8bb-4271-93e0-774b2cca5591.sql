
-- Fix enrich_fm_sale: Use booking.campaign_id for client_campaign_id
CREATE OR REPLACE FUNCTION public.enrich_fm_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_id uuid;
  v_work_email text;
  v_full_name text;
  v_client_id uuid;
  v_campaign_id uuid;
  v_location_id uuid;
BEGIN
  -- Only process fieldmarketing sales
  IF NEW.source != 'fieldmarketing' THEN
    RETURN NEW;
  END IF;

  -- Enrich agent_email/agent_name from fm_seller_id
  IF (NEW.agent_email IS NULL OR btrim(NEW.agent_email) = '') THEN
    v_seller_id := (NEW.raw_payload->>'fm_seller_id')::uuid;
    IF v_seller_id IS NOT NULL THEN
      SELECT work_email, first_name || ' ' || last_name
      INTO v_work_email, v_full_name
      FROM employee_master_data
      WHERE id = v_seller_id
      LIMIT 1;

      IF v_work_email IS NOT NULL THEN
        NEW.agent_email := v_work_email;
      END IF;
      IF v_full_name IS NOT NULL AND (NEW.agent_name IS NULL OR btrim(NEW.agent_name) = '') THEN
        NEW.agent_name := v_full_name;
      END IF;
    END IF;
  END IF;

  -- Enrich client_campaign_id from booking's campaign
  IF NEW.client_campaign_id IS NULL THEN
    v_location_id := (NEW.raw_payload->>'fm_location_id')::uuid;
    
    -- Try to get campaign from booking for this location and sale date
    IF v_location_id IS NOT NULL THEN
      SELECT b.campaign_id INTO v_campaign_id
      FROM booking b
      WHERE b.location_id = v_location_id
        AND b.campaign_id IS NOT NULL
        AND NEW.sale_datetime::date BETWEEN b.start_date::date AND b.end_date::date
      ORDER BY b.start_date DESC
      LIMIT 1;
    END IF;

    -- Fallback: if no booking campaign found, use first campaign for client
    IF v_campaign_id IS NULL THEN
      v_client_id := (NEW.raw_payload->>'fm_client_id')::uuid;
      IF v_client_id IS NOT NULL THEN
        SELECT id INTO v_campaign_id
        FROM client_campaigns
        WHERE client_id = v_client_id
        ORDER BY created_at ASC
        LIMIT 1;
      END IF;
    END IF;

    IF v_campaign_id IS NOT NULL THEN
      NEW.client_campaign_id := v_campaign_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix create_fm_sale_items: Match campaign_mapping_ids in pricing rules
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
  -- Only process fieldmarketing sales
  IF NEW.source != 'fieldmarketing' THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard: skip if sale_items already exist
  IF EXISTS (SELECT 1 FROM sale_items WHERE sale_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Extract product name from raw_payload
  v_product_name := NEW.raw_payload->>'fm_product_name';
  IF v_product_name IS NULL OR btrim(v_product_name) = '' THEN
    INSERT INTO integration_logs (provider, event_type, status, message, payload)
    VALUES ('fieldmarketing', 'sale_item_creation', 'warning',
            'No fm_product_name in raw_payload for sale ' || NEW.id,
            jsonb_build_object('sale_id', NEW.id));
    RETURN NEW;
  END IF;

  -- Match product by name (case-insensitive, trimmed)
  SELECT id, name, commission_dkk, revenue_dkk
  INTO v_product_id, v_display_name, v_commission, v_revenue
  FROM products
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_product_name))
    AND is_active = true
  ORDER BY priority DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

  -- If no product found, log and skip
  IF v_product_id IS NULL THEN
    INSERT INTO integration_logs (provider, event_type, status, message, payload)
    VALUES ('fieldmarketing', 'sale_item_creation', 'warning',
            'Unmatched product name: ' || v_product_name || ' for sale ' || NEW.id,
            jsonb_build_object('sale_id', NEW.id, 'product_name', v_product_name));
    RETURN NEW;
  END IF;

  -- 1. Find adversus_campaign_mapping_id for the sale's client_campaign
  IF NEW.client_campaign_id IS NOT NULL THEN
    SELECT id INTO v_campaign_mapping_id
    FROM adversus_campaign_mappings
    WHERE client_campaign_id = NEW.client_campaign_id
    LIMIT 1;
  END IF;

  -- 2. Try campaign-specific pricing rule first
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

  -- 3. Fallback: universal rule (no campaign restriction)
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

  -- Use pricing rule if found, otherwise keep product base prices
  IF v_rule_commission IS NOT NULL THEN
    v_commission := v_rule_commission;
  END IF;
  IF v_rule_revenue IS NOT NULL THEN
    v_revenue := v_rule_revenue;
  END IF;

  -- Insert sale_item
  INSERT INTO sale_items (sale_id, product_id, mapped_commission, mapped_revenue, display_name, adversus_product_title, quantity)
  VALUES (NEW.id, v_product_id, COALESCE(v_commission, 0), COALESCE(v_revenue, 0), v_display_name, v_product_name, 1)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
