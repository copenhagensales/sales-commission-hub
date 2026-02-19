
-- ============================================================
-- FASE 1: FM Triggers + Backfill
-- Step 1.1: BEFORE INSERT trigger - enrich_fm_sale()
-- Step 1.2: AFTER INSERT trigger - create_fm_sale_items()
-- ============================================================

-- Step 1.1: Enrich FM sales with agent_email and client_campaign_id
CREATE OR REPLACE FUNCTION public.enrich_fm_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seller_id uuid;
  v_work_email text;
  v_full_name text;
  v_client_id uuid;
  v_campaign_id uuid;
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

  -- Enrich client_campaign_id from fm_client_id
  IF NEW.client_campaign_id IS NULL THEN
    v_client_id := (NEW.raw_payload->>'fm_client_id')::uuid;
    IF v_client_id IS NOT NULL THEN
      SELECT id INTO v_campaign_id
      FROM client_campaigns
      WHERE client_id = v_client_id
      ORDER BY created_at ASC
      LIMIT 1;

      IF v_campaign_id IS NOT NULL THEN
        NEW.client_campaign_id := v_campaign_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enrich_fm_sale_trigger
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.enrich_fm_sale();

-- Step 1.2: AFTER INSERT trigger - create sale_items for FM sales
CREATE OR REPLACE FUNCTION public.create_fm_sale_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_name text;
  v_product_id uuid;
  v_commission numeric;
  v_revenue numeric;
  v_display_name text;
  v_rule_commission numeric;
  v_rule_revenue numeric;
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
    -- Log warning and skip
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

  -- If no product found, log and skip (don't pollute KPIs)
  IF v_product_id IS NULL THEN
    INSERT INTO integration_logs (provider, event_type, status, message, payload)
    VALUES ('fieldmarketing', 'sale_item_creation', 'warning',
            'Unmatched product name: ' || v_product_name || ' for sale ' || NEW.id,
            jsonb_build_object('sale_id', NEW.id, 'product_name', v_product_name));
    RETURN NEW;
  END IF;

  -- Check for pricing rule override
  SELECT commission_dkk, revenue_dkk
  INTO v_rule_commission, v_rule_revenue
  FROM product_pricing_rules
  WHERE product_id = v_product_id
    AND is_active = true
  ORDER BY priority DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

  -- Use pricing rule if found, otherwise product base prices
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
$$;

CREATE TRIGGER create_fm_sale_items_trigger
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.create_fm_sale_items();
