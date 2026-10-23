ALTER TABLE public.booking
  ADD COLUMN IF NOT EXISTS quoted_price_date date,
  ADD COLUMN IF NOT EXISTS quoted_price_ref text,
  ADD COLUMN IF NOT EXISTS price_review_needed boolean NOT NULL DEFAULT false;

-- Bookingplanlæggere skal kunne se undtagelserne (ingen persondata), så trigger og dialog virker for dem
CREATE POLICY "Planners can view location exceptions" ON public.supplier_location_exceptions
  FOR SELECT TO authenticated USING (public.is_vagt_admin_or_planner(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_outside_agreement_location(p_location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.location l
    JOIN public.supplier_location_exceptions e
      ON e.is_active AND e.exception_type = 'outside_agreement'
     AND e.location_type = l.type AND lower(e.location_name) = lower(l.name)
    WHERE l.id = p_location_id)
$$;

-- Kører før trg_apply_list_price (alfabetisk: trg_a_ < trg_ap)
CREATE OR REPLACE FUNCTION public.booking_enforce_quoted_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_outside_agreement_location(NEW.location_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.total_price IS NULL THEN
    RAISE EXCEPTION 'Lokationen er ''spørg om pris'' – indtast den aftalte pris';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.price_model := 'quoted';
    RETURN NEW;
  END IF;
  NEW.price_model := 'quoted';
  IF NEW.total_price IS DISTINCT FROM OLD.total_price THEN
    -- ny aftalt pris indtastet: prisen er bekræftet
    NEW.price_review_needed := false;
  ELSIF NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date
     OR NEW.booked_days IS DISTINCT FROM OLD.booked_days THEN
    NEW.price_review_needed := true;
    NEW.price_note := 'Periode ændret – bekræft pris med Ocean';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_a_enforce_quoted_price
  BEFORE INSERT OR UPDATE ON public.booking
  FOR EACH ROW EXECUTE FUNCTION public.booking_enforce_quoted_price();

-- Listepris-triggeren rører aldrig quoted-bookinger
CREATE OR REPLACE FUNCTION public.booking_apply_list_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_g numeric;
  v_rate numeric;
BEGIN
  IF NEW.price_model = 'quoted' OR public.is_outside_agreement_location(NEW.location_id) THEN
    RETURN NEW;
  END IF;
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

CREATE OR REPLACE FUNCTION public.booking_gross_amount(p_booking_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN b.price_model = 'quoted' THEN COALESCE(b.total_price, 0)
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
$function$;