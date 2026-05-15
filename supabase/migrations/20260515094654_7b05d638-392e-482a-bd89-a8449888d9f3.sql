CREATE OR REPLACE FUNCTION public.validate_booking_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RAISE EXCEPTION 'Booking skal have en kampagne (campaign_id må ikke være tom). Tilføj kampagne-mapping på lokationen for den valgte kunde.'
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_require_campaign ON public.booking;

CREATE TRIGGER booking_require_campaign
BEFORE INSERT OR UPDATE OF campaign_id, client_id ON public.booking
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_campaign();