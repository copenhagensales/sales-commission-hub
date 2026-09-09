-- 1. Columns
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS discount_percent_locked numeric NULL,
  ADD COLUMN IF NOT EXISTS discount_rule_id uuid NULL REFERENCES public.supplier_discount_rules(id),
  ADD COLUMN IF NOT EXISTS discount_basis numeric NULL,
  ADD COLUMN IF NOT EXISTS discount_locked_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_booking_location_created_at
  ON public.booking (location_id, created_at);

-- 2. Gross amount: single source of truth for the price formula
CREATE OR REPLACE FUNCTION public.booking_gross_amount(p_booking_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN b.total_price IS NOT NULL THEN b.total_price
    ELSE COALESCE(b.daily_rate_override, lp.daily_rate, l.daily_rate, 0)::numeric * (
      SELECT count(*)
      FROM generate_series(b.start_date, b.end_date, interval '1 day') d
      WHERE b.booked_days IS NULL
         OR array_length(b.booked_days, 1) IS NULL
         OR (extract(isodow FROM d)::int - 1) = ANY (b.booked_days)
    )
  END
  FROM public.booking b
  JOIN public.location l ON l.id = b.location_id
  LEFT JOIN public.location_placements lp ON lp.id = b.placement_id
  WHERE b.id = p_booking_id;
$$;

-- 3. Discount rate at a point in time
CREATE OR REPLACE FUNCTION public.calc_supplier_discount_at(
  p_location_id uuid,
  p_at timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE(discount_percent numeric, rule_id uuid, basis numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_has_rules boolean;
  v_basis numeric := 0;
  v_percent numeric := 0;
  v_rule_id uuid;
  v_exc_type text;
  v_exc_max numeric;
BEGIN
  SELECT l.type INTO v_type FROM public.location l WHERE l.id = p_location_id;
  IF v_type IS NULL THEN
    RETURN QUERY SELECT NULL::numeric, NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.supplier_discount_rules r
    WHERE r.location_type = v_type AND r.is_active AND r.discount_type = 'annual_revenue'
  ) INTO v_has_rules;

  IF NOT v_has_rules THEN
    RETURN QUERY SELECT NULL::numeric, NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  SELECT COALESCE(sum(public.booking_gross_amount(b.id)), 0)
    INTO v_basis
  FROM public.booking b
  JOIN public.location l ON l.id = b.location_id
  LEFT JOIN public.supplier_location_exceptions e
    ON e.is_active
   AND e.location_type = v_type
   AND lower(e.location_name) = lower(l.name)
   AND e.exception_type = 'excluded'
  WHERE l.type = v_type
    AND b.status = 'confirmed'
    AND b.created_at < p_at
    AND extract(year FROM b.created_at) = extract(year FROM p_at)
    AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
    AND e.id IS NULL;

  SELECT r.discount_percent, r.id
    INTO v_percent, v_rule_id
  FROM public.supplier_discount_rules r
  WHERE r.location_type = v_type
    AND r.is_active
    AND r.discount_type = 'annual_revenue'
    AND v_basis >= COALESCE(r.min_revenue, 0)
  ORDER BY COALESCE(r.min_revenue, 0) DESC
  LIMIT 1;

  v_percent := COALESCE(v_percent, 0);

  SELECT e.exception_type, e.max_discount_percent
    INTO v_exc_type, v_exc_max
  FROM public.supplier_location_exceptions e
  JOIN public.location l ON lower(l.name) = lower(e.location_name)
  WHERE e.is_active
    AND e.location_type = v_type
    AND l.id = p_location_id
  LIMIT 1;

  IF v_exc_type = 'excluded' THEN
    v_percent := 0;
  ELSIF v_exc_type = 'max_discount' AND v_exc_max IS NOT NULL THEN
    v_percent := least(v_percent, v_exc_max);
  END IF;

  RETURN QUERY SELECT v_percent, v_rule_id, v_basis;
END;
$$;

-- 4. Stamp on insert only
CREATE OR REPLACE FUNCTION public.stamp_booking_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct numeric;
  v_rule uuid;
  v_basis numeric;
BEGIN
  IF NEW.discount_percent_locked IS NOT NULL THEN
    IF NEW.discount_locked_at IS NULL THEN
      NEW.discount_locked_at := now();
    END IF;
    RETURN NEW;
  END IF;

  SELECT c.discount_percent, c.rule_id, c.basis
    INTO v_pct, v_rule, v_basis
  FROM public.calc_supplier_discount_at(NEW.location_id, COALESCE(NEW.created_at, now()), NEW.id) c;

  IF v_pct IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.discount_percent_locked := v_pct;
  NEW.discount_rule_id := v_rule;
  NEW.discount_basis := v_basis;
  NEW.discount_locked_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_booking_discount ON public.booking;
CREATE TRIGGER trg_stamp_booking_discount
BEFORE INSERT ON public.booking
FOR EACH ROW EXECUTE FUNCTION public.stamp_booking_discount();

-- 5. Manual re-stamp, superadmin only
CREATE OR REPLACE FUNCTION public.relock_booking_discount(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loc uuid;
  v_created timestamptz;
  v_old numeric;
  v_pct numeric;
  v_rule uuid;
  v_basis numeric;
BEGIN
  IF NOT public.am_i_superadmin() THEN
    RAISE EXCEPTION 'Kun superadmin kan omstemple rabatten';
  END IF;

  SELECT b.location_id, b.created_at, b.discount_percent_locked
    INTO v_loc, v_created, v_old
  FROM public.booking b WHERE b.id = p_booking_id;

  IF v_loc IS NULL THEN
    RAISE EXCEPTION 'Booking findes ikke';
  END IF;

  SELECT c.discount_percent, c.rule_id, c.basis
    INTO v_pct, v_rule, v_basis
  FROM public.calc_supplier_discount_at(v_loc, v_created, p_booking_id) c;

  UPDATE public.booking
     SET discount_percent_locked = v_pct,
         discount_rule_id = v_rule,
         discount_basis = v_basis,
         discount_locked_at = now()
   WHERE id = p_booking_id;

  INSERT INTO public.integration_debug_log (source, event_type, message, payload)
  VALUES (
    'supplier-discount',
    'relock_booking_discount',
    'Rabat omstemplet manuelt',
    jsonb_build_object(
      'booking_id', p_booking_id,
      'old_percent', v_old,
      'new_percent', v_pct,
      'basis', v_basis,
      'by', auth.uid()
    )
  );
END;
$$;

-- 6. Supplier level status for UI
CREATE OR REPLACE FUNCTION public.get_supplier_discount_status(
  p_location_type text,
  p_at timestamptz DEFAULT now()
)
RETURNS TABLE(
  basis numeric,
  current_percent numeric,
  current_rule_id uuid,
  next_min_revenue numeric,
  next_percent numeric,
  remaining_to_next numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_basis numeric := 0;
  v_pct numeric;
  v_rule uuid;
  v_next_min numeric;
  v_next_pct numeric;
BEGIN
  SELECT COALESCE(sum(public.booking_gross_amount(b.id)), 0)
    INTO v_basis
  FROM public.booking b
  JOIN public.location l ON l.id = b.location_id
  LEFT JOIN public.supplier_location_exceptions e
    ON e.is_active
   AND e.location_type = p_location_type
   AND lower(e.location_name) = lower(l.name)
   AND e.exception_type = 'excluded'
  WHERE l.type = p_location_type
    AND b.status = 'confirmed'
    AND b.created_at <= p_at
    AND extract(year FROM b.created_at) = extract(year FROM p_at)
    AND e.id IS NULL;

  SELECT r.discount_percent, r.id INTO v_pct, v_rule
  FROM public.supplier_discount_rules r
  WHERE r.location_type = p_location_type
    AND r.is_active
    AND r.discount_type = 'annual_revenue'
    AND v_basis >= COALESCE(r.min_revenue, 0)
  ORDER BY COALESCE(r.min_revenue, 0) DESC
  LIMIT 1;

  SELECT COALESCE(r.min_revenue, 0), r.discount_percent INTO v_next_min, v_next_pct
  FROM public.supplier_discount_rules r
  WHERE r.location_type = p_location_type
    AND r.is_active
    AND r.discount_type = 'annual_revenue'
    AND COALESCE(r.min_revenue, 0) > v_basis
  ORDER BY COALESCE(r.min_revenue, 0) ASC
  LIMIT 1;

  RETURN QUERY SELECT
    v_basis,
    COALESCE(v_pct, 0),
    v_rule,
    v_next_min,
    v_next_pct,
    CASE WHEN v_next_min IS NULL THEN NULL ELSE greatest(v_next_min - v_basis, 0) END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.booking_gross_amount(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_supplier_discount_at(uuid, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relock_booking_discount(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_discount_status(text, timestamptz) TO authenticated;