-- 1. Fix enrich_fm_sale: hard-filter on fm_client_id everywhere + fix payload key bug
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
  v_fm_client_id uuid;
  v_campaign_id uuid;
  v_location_id uuid;
  v_product_name text;
  v_booking_id uuid;
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

  -- Enrich client_campaign_id — STRICTLY scoped to sælgers valgte fm_client_id
  IF NEW.client_campaign_id IS NULL THEN
    v_fm_client_id := NULLIF(NEW.raw_payload->>'fm_client_id', '')::uuid;
    v_location_id := NULLIF(NEW.raw_payload->>'fm_location_id', '')::uuid;
    -- FIX: previous version read 'product_name' which never exists in payload
    v_product_name := LOWER(COALESCE(NEW.raw_payload->>'fm_product_name', ''));

    -- Step 1: booking-match — MUST match both location AND sælgers valgte klient
    IF v_location_id IS NOT NULL AND v_fm_client_id IS NOT NULL THEN
      SELECT b.campaign_id, b.id INTO v_campaign_id, v_booking_id
      FROM booking b
      WHERE b.location_id = v_location_id
        AND b.client_id = v_fm_client_id
        AND NEW.sale_datetime::date BETWEEN b.start_date::date AND b.end_date::date
      ORDER BY b.start_date DESC, b.id DESC
      LIMIT 1;

      -- Booking findes men har ikke campaign_id
      IF v_booking_id IS NOT NULL AND v_campaign_id IS NULL THEN
        INSERT INTO integration_logs (integration_type, status, message, details)
        VALUES (
          'fieldmarketing',
          'warning',
          'Booking fundet uden campaign_id – bruger fallback',
          jsonb_build_object(
            'booking_id', v_booking_id,
            'location_id', v_location_id,
            'fm_client_id', v_fm_client_id,
            'sale_date', NEW.sale_datetime::date,
            'product_name', NEW.raw_payload->>'fm_product_name'
          )
        );
      END IF;

      -- Ingen booking-match for sælgers valgte klient på lokationen
      IF v_booking_id IS NULL THEN
        INSERT INTO integration_logs (integration_type, status, message, details)
        VALUES (
          'fieldmarketing',
          'warning',
          'Ingen booking på lokationen for sælgers valgte klient – bruger campaign-fallback',
          jsonb_build_object(
            'sale_id', NEW.id,
            'location_id', v_location_id,
            'fm_client_id', v_fm_client_id,
            'sale_date', NEW.sale_datetime::date
          )
        );
      END IF;
    END IF;

    -- Step 2: smart product-name match – scoped to sælgers valgte klient
    IF v_campaign_id IS NULL AND v_fm_client_id IS NOT NULL THEN
      SELECT id INTO v_campaign_id
      FROM client_campaigns
      WHERE client_id = v_fm_client_id
        AND (
          (v_product_name LIKE '%gade%' AND LOWER(name) LIKE '%gade%')
          OR (v_product_name LIKE '%marked%' AND LOWER(name) LIKE '%marked%')
        )
      LIMIT 1;
    END IF;

    -- Step 3: ultimate fallback – ældste kampagne for sælgers valgte klient
    IF v_campaign_id IS NULL AND v_fm_client_id IS NOT NULL THEN
      SELECT id INTO v_campaign_id
      FROM client_campaigns
      WHERE client_id = v_fm_client_id
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF v_campaign_id IS NOT NULL THEN
      NEW.client_campaign_id := v_campaign_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- 2. Backfill: ret de 4 fejlattribuerede salg + regenerér deres sale_items
DO $$
DECLARE
  r RECORD;
  v_correct_campaign_id uuid;
  v_product_name_lower text;
  v_product_id uuid;
  v_display_name text;
  v_commission numeric;
  v_revenue numeric;
  v_rule_commission numeric;
  v_rule_revenue numeric;
  v_campaign_mapping_id uuid;
  v_fm_client_id uuid;
  v_location_id uuid;
  v_fm_product_name text;
BEGIN
  FOR r IN
    SELECT s.id, s.sale_datetime, s.raw_payload
    FROM sales s
    JOIN client_campaigns cc ON cc.id = s.client_campaign_id
    WHERE s.source = 'fieldmarketing'
      AND s.raw_payload->>'fm_client_id' IS NOT NULL
      AND cc.client_id::text <> s.raw_payload->>'fm_client_id'
  LOOP
    v_fm_client_id := NULLIF(r.raw_payload->>'fm_client_id', '')::uuid;
    v_location_id := NULLIF(r.raw_payload->>'fm_location_id', '')::uuid;
    v_fm_product_name := r.raw_payload->>'fm_product_name';
    v_product_name_lower := LOWER(COALESCE(v_fm_product_name, ''));
    v_correct_campaign_id := NULL;

    -- Step 1
    IF v_location_id IS NOT NULL THEN
      SELECT b.campaign_id INTO v_correct_campaign_id
      FROM booking b
      WHERE b.location_id = v_location_id
        AND b.client_id = v_fm_client_id
        AND r.sale_datetime::date BETWEEN b.start_date::date AND b.end_date::date
      ORDER BY b.start_date DESC, b.id DESC
      LIMIT 1;
    END IF;

    -- Step 2
    IF v_correct_campaign_id IS NULL THEN
      SELECT id INTO v_correct_campaign_id
      FROM client_campaigns
      WHERE client_id = v_fm_client_id
        AND (
          (v_product_name_lower LIKE '%gade%' AND LOWER(name) LIKE '%gade%')
          OR (v_product_name_lower LIKE '%marked%' AND LOWER(name) LIKE '%marked%')
        )
      LIMIT 1;
    END IF;

    -- Step 3
    IF v_correct_campaign_id IS NULL THEN
      SELECT id INTO v_correct_campaign_id
      FROM client_campaigns
      WHERE client_id = v_fm_client_id
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF v_correct_campaign_id IS NULL THEN
      RAISE NOTICE 'Skipping sale % – could not resolve campaign for fm_client_id %', r.id, v_fm_client_id;
      CONTINUE;
    END IF;

    -- Update sale
    UPDATE sales SET client_campaign_id = v_correct_campaign_id WHERE id = r.id;

    -- Wipe old sale_items
    DELETE FROM sale_items WHERE sale_id = r.id;

    -- Regenerate sale_items (mirror of create_fm_sale_items)
    IF v_fm_product_name IS NULL OR btrim(v_fm_product_name) = '' THEN
      CONTINUE;
    END IF;

    v_product_id := NULL;
    v_display_name := NULL;
    v_commission := NULL;
    v_revenue := NULL;
    v_rule_commission := NULL;
    v_rule_revenue := NULL;
    v_campaign_mapping_id := NULL;

    SELECT id, name, commission_dkk, revenue_dkk
    INTO v_product_id, v_display_name, v_commission, v_revenue
    FROM products
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_fm_product_name))
      AND is_active = true
    ORDER BY priority DESC NULLS LAST, created_at DESC, id DESC
    LIMIT 1;

    IF v_product_id IS NULL THEN
      RAISE NOTICE 'Skipping sale_items for % – no product match for %', r.id, v_fm_product_name;
      CONTINUE;
    END IF;

    SELECT id INTO v_campaign_mapping_id
    FROM adversus_campaign_mappings
    WHERE client_campaign_id = v_correct_campaign_id
    LIMIT 1;

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
    VALUES (r.id, v_product_id, COALESCE(v_commission, 0), COALESCE(v_revenue, 0), v_display_name, v_fm_product_name, 1);
  END LOOP;
END $$;