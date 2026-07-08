-- 1. Validation trigger: booked_days must fit within [start_date, end_date]
CREATE OR REPLACE FUNCTION public.validate_booking_booked_days()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d date;
  present_weekdays int[] := ARRAY[]::int[];
  iso_day int;
  missing int[];
BEGIN
  -- Null/empty booked_days is fine (means "all days in range")
  IF NEW.booked_days IS NULL OR array_length(NEW.booked_days, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.start_date IS NULL OR NEW.end_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Collect weekdays present in [start_date, end_date]
  -- Convention: 0=Mon, 1=Tue, ..., 6=Sun (matches app code)
  d := NEW.start_date;
  WHILE d <= NEW.end_date LOOP
    iso_day := CASE EXTRACT(DOW FROM d)::int
                 WHEN 0 THEN 6  -- Sunday
                 ELSE EXTRACT(DOW FROM d)::int - 1
               END;
    IF NOT (iso_day = ANY(present_weekdays)) THEN
      present_weekdays := array_append(present_weekdays, iso_day);
    END IF;
    d := d + INTERVAL '1 day';
  END LOOP;

  -- Find any booked_day not present in the date range
  SELECT array_agg(bd)
  INTO missing
  FROM unnest(NEW.booked_days) AS bd
  WHERE NOT (bd = ANY(present_weekdays));

  IF missing IS NOT NULL AND array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION
      'Booking-fejl: booked_days % ligger uden for booking-perioden %..%. Udvid start_date/end_date så alle valgte ugedage er inkluderet.',
      missing, NEW.start_date, NEW.end_date
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_booking_booked_days ON public.booking;
CREATE TRIGGER trg_validate_booking_booked_days
BEFORE INSERT OR UPDATE OF start_date, end_date, booked_days
ON public.booking
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_booked_days();

-- 2. Fix the two Helsingør bookings so end_date matches booked_days
UPDATE public.booking
SET end_date = '2026-06-12'
WHERE start_date = '2026-06-09'
  AND end_date = '2026-06-09'
  AND location_id = (SELECT id FROM public.location WHERE name = 'Bycenter Helsingør' LIMIT 1)
  AND booked_days = '{1,2,3,4}';

UPDATE public.booking
SET end_date = '2026-06-26'
WHERE start_date = '2026-06-22'
  AND end_date = '2026-06-23'
  AND location_id = (SELECT id FROM public.location WHERE name = 'Bycenter Helsingør' LIMIT 1)
  AND booked_days = '{0,1,2,4}';