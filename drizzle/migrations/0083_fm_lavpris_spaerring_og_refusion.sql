ALTER TABLE public.location
  ADD COLUMN IF NOT EXISTS daily_rate_note text,
  ADD COLUMN IF NOT EXISTS gross_daily_rate numeric CHECK (gross_daily_rate IS NULL OR gross_daily_rate >= 0),
  ADD COLUMN IF NOT EXISTS refund_daily_rate numeric CHECK (refund_daily_rate IS NULL OR refund_daily_rate >= 0),
  ADD COLUMN IF NOT EXISTS refund_client_id uuid REFERENCES public.clients(id);

COMMENT ON COLUMN public.location.daily_rate IS 'NETTO dagspris – den værdi der rammer lederens DB';
COMMENT ON COLUMN public.location.gross_daily_rate IS 'Kun visning: pris betalt direkte til lokationen pr. dag (brutto)';
COMMENT ON COLUMN public.location.refund_daily_rate IS 'Kun visning: refusion pr. dag fra refund_client_id';

CREATE OR REPLACE FUNCTION public.booking_low_price_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_days int;
  v_eff numeric;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.total_price IS NOT DISTINCT FROM OLD.total_price
     AND NEW.daily_rate_override IS NOT DISTINCT FROM OLD.daily_rate_override THEN
    RETURN NEW;
  END IF;
  IF NEW.total_price IS NOT NULL THEN
    v_days := greatest(coalesce(array_length(NEW.booked_days, 1), 0), 1);
    v_eff := NEW.total_price / v_days;
  ELSE
    v_eff := NEW.daily_rate_override;
  END IF;
  IF v_eff IS NOT NULL AND v_eff < 100 AND coalesce(btrim(NEW.price_note), '') = '' THEN
    RAISE EXCEPTION 'Prisen er under 100 kr. pr. dag – skriv en begrundelse' USING ERRCODE = 'P0001', HINT = 'stork_lav_pris';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_z_low_price_guard
BEFORE INSERT OR UPDATE ON public.booking
FOR EACH ROW EXECUTE FUNCTION public.booking_low_price_guard();

CREATE OR REPLACE FUNCTION public.location_low_rate_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.daily_rate IS NOT DISTINCT FROM OLD.daily_rate THEN
    RETURN NEW;
  END IF;
  IF NEW.daily_rate IS NOT NULL AND NEW.daily_rate < 100 AND coalesce(btrim(NEW.daily_rate_note), '') = '' THEN
    RAISE EXCEPTION 'Dagsprisen er under 100 kr. – skriv en begrundelse' USING ERRCODE = 'P0001', HINT = 'stork_lav_pris';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_z_location_low_rate_guard
BEFORE INSERT OR UPDATE ON public.location
FOR EACH ROW EXECUTE FUNCTION public.location_low_rate_guard();