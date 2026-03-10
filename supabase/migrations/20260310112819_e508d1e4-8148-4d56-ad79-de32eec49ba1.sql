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

  -- Enrich client_campaign_id from booking's campaign
  IF NEW.client_campaign_id IS NULL THEN
    v_location_id := (NEW.raw_payload->>'fm_location_id')::uuid;
    v_product_name := LOWER(COALESCE(NEW.raw_payload->>'product_name', ''));
    
    -- Step 1: Try to get campaign from booking for this location and sale date
    IF v_location_id IS NOT NULL THEN
      SELECT b.campaign_id, b.id INTO v_campaign_id, v_booking_id
      FROM booking b
      WHERE b.location_id = v_location_id
        AND NEW.sale_datetime::date BETWEEN b.start_date::date AND b.end_date::date
      ORDER BY b.start_date DESC
      LIMIT 1;
      
      -- Log warning if booking exists but has no campaign_id
      IF v_booking_id IS NOT NULL AND v_campaign_id IS NULL THEN
        INSERT INTO integration_logs (integration_type, status, message, details)
        VALUES (
          'fieldmarketing',
          'warning',
          'Booking fundet uden campaign_id – bruger fallback',
          jsonb_build_object(
            'booking_id', v_booking_id,
            'location_id', v_location_id,
            'sale_date', NEW.sale_datetime::date,
            'product_name', NEW.raw_payload->>'product_name'
          )
        );
      END IF;
    END IF;

    -- Step 2: Fallback – match product name against campaign name for the client
    IF v_campaign_id IS NULL THEN
      v_client_id := (NEW.raw_payload->>'fm_client_id')::uuid;
      IF v_client_id IS NOT NULL THEN
        -- Try smart matching: "gade" in product → campaign with "gade" in name
        SELECT id INTO v_campaign_id
        FROM client_campaigns
        WHERE client_id = v_client_id
          AND (
            (v_product_name LIKE '%gade%' AND LOWER(name) LIKE '%gade%')
            OR (v_product_name LIKE '%marked%' AND LOWER(name) LIKE '%marked%')
          )
        LIMIT 1;
        
        -- Step 3: Ultimate fallback – first campaign for client
        IF v_campaign_id IS NULL THEN
          SELECT id INTO v_campaign_id
          FROM client_campaigns
          WHERE client_id = v_client_id
          ORDER BY created_at ASC
          LIMIT 1;
        END IF;
      END IF;
    END IF;

    IF v_campaign_id IS NOT NULL THEN
      NEW.client_campaign_id := v_campaign_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;