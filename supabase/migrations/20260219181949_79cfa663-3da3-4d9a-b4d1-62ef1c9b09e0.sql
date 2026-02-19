
-- =============================================================
-- FASE 1: Database Foundation for FM Konsolidering
-- Step 1.1: BEFORE INSERT trigger - enrich_fm_sale()
-- Step 1.2: AFTER INSERT trigger - create_fm_sale_items()
-- Step 1.3: FK/CASCADE assertion
-- Step 1.4: Backfill ~393 manglende sale_items
-- Step 1.5: Backfill product_id paa eksisterende items
-- Step 1.6: Berig agent_email paa FM salg
-- =============================================================

-- =====================
-- Step 1.3: FK/CASCADE assertion (run first to fail fast)
-- =====================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sale_items'::regclass
      AND contype = 'f'
      AND conname LIKE '%sale_id%'
      AND confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'HARD GATE FAILED: sale_items.sale_id FK does not have ON DELETE CASCADE';
  END IF;
END $$;

-- =====================
-- Step 1.1: BEFORE INSERT trigger - enrich_fm_sale()
-- =====================
CREATE OR REPLACE FUNCTION public.enrich_fm_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee RECORD;
  v_campaign_id UUID;
BEGIN
  -- Only process fieldmarketing sales
  IF NEW.source IS DISTINCT FROM 'fieldmarketing' THEN
    RETURN NEW;
  END IF;

  -- Enrich agent_email and agent_name if missing
  IF NEW.agent_email IS NULL OR btrim(NEW.agent_email) = '' THEN
    IF NEW.raw_payload IS NOT NULL AND (NEW.raw_payload->>'fm_seller_id') IS NOT NULL THEN
      SELECT work_email, first_name, last_name
      INTO v_employee
      FROM employee_master_data
      WHERE id = (NEW.raw_payload->>'fm_seller_id')::uuid
      LIMIT 1;

      IF v_employee IS NOT NULL THEN
        NEW.agent_email := v_employee.work_email;
        IF NEW.agent_name IS NULL OR btrim(NEW.agent_name) = '' THEN
          NEW.agent_name := v_employee.first_name || ' ' || v_employee.last_name;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Enrich client_campaign_id if missing
  IF NEW.client_campaign_id IS NULL THEN
    IF NEW.raw_payload IS NOT NULL AND (NEW.raw_payload->>'fm_client_id') IS NOT NULL THEN
      SELECT id INTO v_campaign_id
      FROM client_campaigns
      WHERE client_id = (NEW.raw_payload->>'fm_client_id')::uuid
      ORDER BY created_at DESC, id DESC
      LIMIT 1;

      IF v_campaign_id IS NOT NULL THEN
        NEW.client_campaign_id := v_campaign_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enrich_fm_sale
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.enrich_fm_sale();

-- =====================
-- Step 1.2: AFTER INSERT trigger - create_fm_sale_items()
-- =====================
CREATE OR REPLACE FUNCTION public.create_fm_sale_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product RECORD;
  v_pricing_rule RECORD;
  v_product_name TEXT;
  v_commission NUMERIC;
  v_revenue NUMERIC;
  v_display_name TEXT;
  v_pricing_rule_id UUID;
BEGIN
  -- Only process fieldmarketing sales
  IF NEW.source IS DISTINCT FROM 'fieldmarketing' THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard: skip if sale_items already exist for this sale
  IF EXISTS (SELECT 1 FROM sale_items WHERE sale_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Extract product name from raw_payload
  v_product_name := NEW.raw_payload->>'fm_product_name';
  IF v_product_name IS NULL OR btrim(v_product_name) = '' THEN
    -- No product name - log and skip
    INSERT INTO integration_logs (integration_type, status, message, details)
    VALUES (
      'fieldmarketing', 'warning',
      'FM sale missing fm_product_name in raw_payload',
      jsonb_build_object('sale_id', NEW.id, 'raw_payload_keys', COALESCE(jsonb_object_keys_array(NEW.raw_payload), '[]'::jsonb))
    );
    RETURN NEW;
  END IF;

  -- Match product by normalized name (case-insensitive, trimmed)
  SELECT id, name, commission_dkk, revenue_dkk
  INTO v_product
  FROM products
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_product_name))
    AND COALESCE(is_hidden, false) = false
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- If no product match: log warning and DO NOT create sale_items
  IF v_product IS NULL THEN
    INSERT INTO integration_logs (integration_type, status, message, details)
    VALUES (
      'fieldmarketing', 'warning',
      'FM sale has unmatched product name - no sale_items created',
      jsonb_build_object('sale_id', NEW.id, 'fm_product_name', v_product_name)
    );
    RETURN NEW;
  END IF;

  -- Find best pricing rule for this product
  SELECT id, commission_dkk, revenue_dkk, name, use_rule_name_as_display
  INTO v_pricing_rule
  FROM product_pricing_rules
  WHERE product_id = v_product.id
    AND is_active = true
  ORDER BY priority DESC, created_at DESC, id DESC
  LIMIT 1;

  -- Determine commission, revenue, and display name
  IF v_pricing_rule IS NOT NULL THEN
    v_commission := COALESCE(v_pricing_rule.commission_dkk, v_product.commission_dkk, 0);
    v_revenue := COALESCE(v_pricing_rule.revenue_dkk, v_product.revenue_dkk, 0);
    v_pricing_rule_id := v_pricing_rule.id;
    IF v_pricing_rule.use_rule_name_as_display AND v_pricing_rule.name IS NOT NULL THEN
      v_display_name := v_pricing_rule.name;
    ELSE
      v_display_name := v_product.name;
    END IF;
  ELSE
    v_commission := COALESCE(v_product.commission_dkk, 0);
    v_revenue := COALESCE(v_product.revenue_dkk, 0);
    v_pricing_rule_id := NULL;
    v_display_name := v_product.name;
  END IF;

  -- Insert sale_item with ON CONFLICT DO NOTHING for safety
  INSERT INTO sale_items (
    sale_id, product_id, adversus_product_title, display_name,
    mapped_commission, mapped_revenue, matched_pricing_rule_id, quantity
  )
  VALUES (
    NEW.id, v_product.id, v_product_name, v_display_name,
    v_commission, v_revenue, v_pricing_rule_id, 1
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Helper function for jsonb keys as array (used in logging)
CREATE OR REPLACE FUNCTION public.jsonb_object_keys_array(p_json jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(key), '[]'::jsonb) FROM jsonb_object_keys(p_json) AS key;
$$;

CREATE TRIGGER trg_create_fm_sale_items
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.create_fm_sale_items();

-- =====================
-- Step 1.4: Backfill ~393 manglende sale_items
-- =====================
INSERT INTO sale_items (sale_id, product_id, adversus_product_title, display_name, mapped_commission, mapped_revenue, matched_pricing_rule_id, quantity)
SELECT
  s.id AS sale_id,
  p.id AS product_id,
  s.raw_payload->>'fm_product_name' AS adversus_product_title,
  COALESCE(
    CASE WHEN pr.use_rule_name_as_display AND pr.name IS NOT NULL THEN pr.name ELSE NULL END,
    p.name
  ) AS display_name,
  COALESCE(pr.commission_dkk, p.commission_dkk, 0) AS mapped_commission,
  COALESCE(pr.revenue_dkk, p.revenue_dkk, 0) AS mapped_revenue,
  pr.id AS matched_pricing_rule_id,
  1 AS quantity
FROM sales s
CROSS JOIN LATERAL (
  SELECT id, name, commission_dkk, revenue_dkk
  FROM products
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(s.raw_payload->>'fm_product_name'))
    AND COALESCE(is_hidden, false) = false
  ORDER BY created_at DESC, id DESC
  LIMIT 1
) p
LEFT JOIN LATERAL (
  SELECT id, commission_dkk, revenue_dkk, name, use_rule_name_as_display
  FROM product_pricing_rules
  WHERE product_id = p.id AND is_active = true
  ORDER BY priority DESC, created_at DESC, id DESC
  LIMIT 1
) pr ON true
WHERE s.source = 'fieldmarketing'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)
  AND s.raw_payload->>'fm_product_name' IS NOT NULL
  AND btrim(s.raw_payload->>'fm_product_name') != ''
ON CONFLICT DO NOTHING;

-- Log any FM sales that couldn't be backfilled (unmatched product)
INSERT INTO integration_logs (integration_type, status, message, details)
SELECT
  'fieldmarketing', 'warning',
  'Backfill: FM sale has unmatched product name',
  jsonb_build_object('sale_id', s.id, 'fm_product_name', s.raw_payload->>'fm_product_name')
FROM sales s
WHERE s.source = 'fieldmarketing'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)
  AND s.raw_payload->>'fm_product_name' IS NOT NULL
  AND btrim(s.raw_payload->>'fm_product_name') != ''
  AND NOT EXISTS (
    SELECT 1 FROM products
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(s.raw_payload->>'fm_product_name'))
      AND COALESCE(is_hidden, false) = false
  );

-- =====================
-- Step 1.5: Backfill product_id on existing FM sale_items where NULL
-- =====================
UPDATE sale_items si
SET
  product_id = p.id,
  mapped_commission = COALESCE(pr.commission_dkk, p.commission_dkk, si.mapped_commission),
  mapped_revenue = COALESCE(pr.revenue_dkk, p.revenue_dkk, si.mapped_revenue),
  matched_pricing_rule_id = COALESCE(pr.id, si.matched_pricing_rule_id),
  display_name = COALESCE(
    CASE WHEN pr.use_rule_name_as_display AND pr.name IS NOT NULL THEN pr.name ELSE NULL END,
    p.name,
    si.display_name
  )
FROM sales s
CROSS JOIN LATERAL (
  SELECT id, name, commission_dkk, revenue_dkk
  FROM products
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(s.raw_payload->>'fm_product_name'))
    AND COALESCE(is_hidden, false) = false
  ORDER BY created_at DESC, id DESC
  LIMIT 1
) p
LEFT JOIN LATERAL (
  SELECT id, commission_dkk, revenue_dkk, name, use_rule_name_as_display
  FROM product_pricing_rules
  WHERE product_id = p.id AND is_active = true
  ORDER BY priority DESC, created_at DESC, id DESC
  LIMIT 1
) pr ON true
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND si.product_id IS NULL
  AND s.raw_payload->>'fm_product_name' IS NOT NULL;

-- =====================
-- Step 1.6: Backfill agent_email on ~110 FM sales
-- =====================
UPDATE sales s
SET
  agent_email = e.work_email,
  agent_name = COALESCE(
    NULLIF(btrim(s.agent_name), ''),
    e.first_name || ' ' || e.last_name
  )
FROM employee_master_data e
WHERE s.source = 'fieldmarketing'
  AND (s.agent_email IS NULL OR btrim(s.agent_email) = '')
  AND s.raw_payload->>'fm_seller_id' IS NOT NULL
  AND e.id = (s.raw_payload->>'fm_seller_id')::uuid;
