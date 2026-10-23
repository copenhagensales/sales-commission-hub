-- 1) Aftaleperiode som data på rabatreglen
ALTER TABLE public.supplier_discount_rules
  ADD COLUMN IF NOT EXISTS agreement_start date,
  ADD COLUMN IF NOT EXISTS agreement_end date;

-- 2) Undtagelsestype "uden for aftale" + note
ALTER TABLE public.supplier_location_exceptions DROP CONSTRAINT IF EXISTS valid_exception_type;
ALTER TABLE public.supplier_location_exceptions
  ADD CONSTRAINT valid_exception_type CHECK (exception_type = ANY (ARRAY['max_discount'::text, 'excluded'::text, 'outside_agreement'::text]));
ALTER TABLE public.supplier_location_exceptions ADD COLUMN IF NOT EXISTS note text;

-- 3) Listepriser pr. placering (ekskl. moms). daily_rate røres ikke, så eksisterende brutto er uændret.
ALTER TABLE public.location_placements
  ADD COLUMN IF NOT EXISTS list_week_price numeric,
  ADD COLUMN IF NOT EXISTS list_day_price numeric,
  ADD COLUMN IF NOT EXISTS list_4day_price numeric,
  ADD COLUMN IF NOT EXISTS list_5day_price numeric,
  ADD COLUMN IF NOT EXISTS price_needs_confirmation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_note text;

-- Booking: prisnote + hvilken prismodel der stemplede total_price
ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS price_note text,
  ADD COLUMN IF NOT EXISTS price_model text;

-- Listepris-brutto: pr. ISO-uge: 1-3 dage = dag x dage, 4 = 4-dagespris, 5 = 5-dagespris, 6-7 = ugepris.
-- Manglende 4/5/uge-pris falder tilbage til dagspris x dage.
CREATE OR REPLACE FUNCTION public.list_price_gross(p_placement_id uuid, p_start date, p_end date, p_booked_days integer[])
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH p AS (
    SELECT list_day_price d, list_4day_price p4, list_5day_price p5, list_week_price w
    FROM public.location_placements WHERE id = p_placement_id AND list_day_price IS NOT NULL
  ), days AS (
    SELECT date_trunc('week', g)::date wk, count(*)::int n
    FROM generate_series(p_start, p_end, interval '1 day') g
    WHERE p_booked_days IS NULL OR array_length(p_booked_days, 1) IS NULL
       OR (extract(isodow FROM g)::int - 1) = ANY (p_booked_days)
    GROUP BY 1
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM p) THEN NULL ELSE COALESCE((
    SELECT sum(CASE
      WHEN days.n <= 3 THEN p.d * days.n
      WHEN days.n = 4 THEN COALESCE(p.p4, p.d * 4)
      WHEN days.n = 5 THEN COALESCE(p.p5, p.d * 5)
      ELSE COALESCE(p.w, p.d * days.n) END)
    FROM days, p), 0) END
$$;

CREATE OR REPLACE FUNCTION public.booking_apply_list_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_g numeric;
  v_rate numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.total_price IS NULL AND NEW.placement_id IS NOT NULL THEN
      SELECT daily_rate INTO v_rate FROM public.location_placements WHERE id = NEW.placement_id;
      IF NEW.daily_rate_override IS NULL OR NEW.daily_rate_override = v_rate THEN
        v_g := public.list_price_gross(NEW.placement_id, NEW.start_date, NEW.end_date, NEW.booked_days);
        IF v_g IS NOT NULL THEN
          NEW.total_price := v_g;
          NEW.price_model := 'list_price';
        END IF;
      END IF;
    END IF;
  ELSIF OLD.price_model = 'list_price' AND NEW.total_price IS NOT DISTINCT FROM OLD.total_price THEN
    v_g := public.list_price_gross(NEW.placement_id, NEW.start_date, NEW.end_date, NEW.booked_days);
    IF v_g IS NOT NULL THEN
      NEW.total_price := v_g;
    ELSE
      NEW.total_price := NULL;
      NEW.price_model := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_list_price ON public.booking;
CREATE TRIGGER trg_apply_list_price
  BEFORE INSERT OR UPDATE OF start_date, end_date, booked_days, placement_id ON public.booking
  FOR EACH ROW EXECUTE FUNCTION public.booking_apply_list_price();

-- Ændringslog for pris/rabat på bookinger
CREATE TABLE public.booking_price_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.booking_price_audit TO authenticated;
GRANT ALL ON public.booking_price_audit TO service_role;
ALTER TABLE public.booking_price_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teamledere kan se prislog" ON public.booking_price_audit FOR SELECT TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()));
CREATE POLICY "Bookingredigerende kan skrive prislog" ON public.booking_price_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_vagt_admin_or_planner(auth.uid()) OR public.is_teamleder_or_above(auth.uid()));
CREATE INDEX idx_booking_price_audit_booking ON public.booking_price_audit(booking_id);

CREATE OR REPLACE FUNCTION public.booking_log_price_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_reason text := nullif(current_setting('app.change_reason', true), '');
BEGIN
  IF NEW.total_price IS DISTINCT FROM OLD.total_price THEN
    INSERT INTO public.booking_price_audit(booking_id, field, old_value, new_value, changed_by, reason)
    VALUES (NEW.id, 'total_price', OLD.total_price::text, NEW.total_price::text, auth.uid(), v_reason);
  END IF;
  IF NEW.daily_rate_override IS DISTINCT FROM OLD.daily_rate_override THEN
    INSERT INTO public.booking_price_audit(booking_id, field, old_value, new_value, changed_by, reason)
    VALUES (NEW.id, 'daily_rate_override', OLD.daily_rate_override::text, NEW.daily_rate_override::text, auth.uid(), v_reason);
  END IF;
  IF NEW.discount_percent_locked IS DISTINCT FROM OLD.discount_percent_locked THEN
    INSERT INTO public.booking_price_audit(booking_id, field, old_value, new_value, changed_by, reason)
    VALUES (NEW.id, 'discount_percent_locked', OLD.discount_percent_locked::text, NEW.discount_percent_locked::text, auth.uid(), v_reason);
  END IF;
  IF NEW.price_note IS DISTINCT FROM OLD.price_note THEN
    INSERT INTO public.booking_price_audit(booking_id, field, old_value, new_value, changed_by, reason)
    VALUES (NEW.id, 'price_note', OLD.price_note, NEW.price_note, auth.uid(), v_reason);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_booking_price_change
  AFTER UPDATE OF total_price, daily_rate_override, discount_percent_locked, price_note ON public.booking
  FOR EACH ROW EXECUTE FUNCTION public.booking_log_price_change();

-- Fælles grundlag for rabattrappen (én definition for stempling og status)
CREATE OR REPLACE FUNCTION public.supplier_discount_basis(p_location_type text, p_at timestamptz, p_exclude_booking_id uuid, p_inclusive boolean)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_start date;
  v_end date;
  v_from timestamptz;
  v_to timestamptz;
  v_basis numeric;
  v_day date := (p_at AT TIME ZONE 'Europe/Copenhagen')::date;
BEGIN
  SELECT r.agreement_start, r.agreement_end INTO v_start, v_end
  FROM public.supplier_discount_rules r
  WHERE r.location_type = p_location_type AND r.is_active AND r.discount_type = 'annual_revenue'
    AND r.agreement_start IS NOT NULL AND r.agreement_end IS NOT NULL
    AND v_day BETWEEN r.agreement_start AND r.agreement_end
  LIMIT 1;

  IF v_start IS NOT NULL THEN
    v_from := v_start::timestamp AT TIME ZONE 'Europe/Copenhagen';
    v_to := (v_end + 1)::timestamp AT TIME ZONE 'Europe/Copenhagen';
  ELSE
    v_from := date_trunc('year', p_at);
    v_to := date_trunc('year', p_at) + interval '1 year';
  END IF;

  SELECT COALESCE(sum(public.booking_gross_amount(b.id)), 0) INTO v_basis
  FROM public.booking b
  JOIN public.location l ON l.id = b.location_id
  WHERE l.type = p_location_type
    AND b.status = 'confirmed'
    AND b.created_at >= v_from AND b.created_at < v_to
    AND (CASE WHEN p_inclusive THEN b.created_at <= p_at ELSE b.created_at < p_at END)
    AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.supplier_location_exceptions e
      WHERE e.is_active AND e.location_type = p_location_type
        AND lower(e.location_name) = lower(l.name)
        AND e.exception_type IN ('excluded', 'outside_agreement'));
  RETURN v_basis;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.supplier_discount_basis(text, timestamptz, uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.calc_supplier_discount_at(p_location_id uuid, p_at timestamp with time zone, p_exclude_booking_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(discount_percent numeric, rule_id uuid, basis numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  v_basis := public.supplier_discount_basis(v_type, p_at, p_exclude_booking_id, false);

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

  IF v_exc_type IN ('excluded', 'outside_agreement') THEN
    v_percent := 0;
    v_rule_id := NULL;
  ELSIF v_exc_type = 'max_discount' AND v_exc_max IS NOT NULL THEN
    v_percent := least(v_percent, v_exc_max);
  END IF;

  RETURN QUERY SELECT v_percent, v_rule_id, v_basis;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_supplier_discount_status(p_location_type text, p_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(basis numeric, current_percent numeric, current_rule_id uuid, next_min_revenue numeric, next_percent numeric, remaining_to_next numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_basis numeric := 0;
  v_pct numeric;
  v_rule uuid;
  v_next_min numeric;
  v_next_pct numeric;
BEGIN
  v_basis := public.supplier_discount_basis(p_location_type, p_at, NULL, true);

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
$function$;
