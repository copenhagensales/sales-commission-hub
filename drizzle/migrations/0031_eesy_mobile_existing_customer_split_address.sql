ALTER TABLE public.eesy_mobile_requests
  ADD COLUMN customer_type text NOT NULL DEFAULT 'ny_kunde' CHECK (customer_type IN ('ny_kunde','eksisterende')),
  ADD COLUMN street text, ADD COLUMN house_number text, ADD COLUMN postal_code text, ADD COLUMN city text;
COMMENT ON COLUMN public.eesy_mobile_requests.address IS 'Samlet visningsadresse; udfyldes fra street/house_number/postal_code/city ved nye anmodninger.';

CREATE OR REPLACE FUNCTION public.submit_eesy_mobile_request_v2(
  _customer_type text, _subscription text, _full_name text, _street text, _house_number text,
  _postal_code text, _city text, _cpr text, _phone text, _icc text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _emp uuid; _id uuid; _cpr_c text; _phone_c text; _icc_c text; _pc text; _new boolean;
BEGIN
  IF public.view_as_target() IS NOT NULL THEN RAISE EXCEPTION 'Kan ikke indsendes i "se som"-tilstand'; END IF;
  _emp := public.get_employee_id_for_user(auth.uid());
  IF _emp IS NULL THEN RAISE EXCEPTION 'Ingen medarbejderprofil fundet'; END IF;
  IF _customer_type NOT IN ('ny_kunde','eksisterende') THEN RAISE EXCEPTION 'Ugyldig kundetype'; END IF;
  _new := _customer_type = 'ny_kunde';
  IF NOT (_subscription = ANY(public.eesy_mobile_subscriptions())) THEN RAISE EXCEPTION 'Ugyldigt abonnement'; END IF;
  _cpr_c := regexp_replace(coalesce(_cpr,''), '[^0-9]', '', 'g');
  _phone_c := regexp_replace(coalesce(_phone,''), '[^0-9]', '', 'g');
  _icc_c := regexp_replace(coalesce(_icc,''), '[^0-9]', '', 'g');
  _pc := regexp_replace(coalesce(_postal_code,''), '[^0-9]', '', 'g');
  IF length(trim(coalesce(_full_name,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Navn mangler'; END IF;
  IF length(_cpr_c) <> 10 THEN RAISE EXCEPTION 'CPR-nummer skal være 10 cifre'; END IF;
  IF length(_phone_c) <> 8 THEN RAISE EXCEPTION 'Telefonnummer skal være 8 cifre'; END IF;
  IF _new THEN
    IF length(trim(coalesce(_street,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Vejnavn mangler'; END IF;
    IF trim(coalesce(_house_number,'')) !~ '^[0-9]{1,4}[A-Za-z]?([ ,.].{0,30})?$' THEN RAISE EXCEPTION 'Husnummer er ugyldigt'; END IF;
    IF length(_pc) <> 4 THEN RAISE EXCEPTION 'Postnummer skal være 4 cifre'; END IF;
    IF length(trim(coalesce(_city,''))) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'By mangler'; END IF;
    IF length(_icc_c) NOT BETWEEN 18 AND 22 THEN RAISE EXCEPTION 'ICC-nummer skal være 18-22 cifre'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.eesy_mobile_requests WHERE employee_id = _emp) THEN
    RAISE EXCEPTION 'Du har allerede indsendt en anmodning (kun ét tilbud pr. medarbejder)';
  END IF;
  INSERT INTO public.eesy_mobile_requests(employee_id, customer_type, subscription, full_name, address,
    street, house_number, postal_code, city, cpr_number, phone_number, icc_number)
  VALUES (_emp, _customer_type, _subscription, trim(_full_name),
    CASE WHEN _new THEN trim(_street) || ' ' || trim(_house_number) || ', ' || _pc || ' ' || trim(_city) END,
    CASE WHEN _new THEN trim(_street) END, CASE WHEN _new THEN trim(_house_number) END,
    CASE WHEN _new THEN _pc END, CASE WHEN _new THEN trim(_city) END,
    _cpr_c, _phone_c, CASE WHEN _new THEN _icc_c END)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.submit_eesy_mobile_request_v2(text,text,text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_eesy_mobile_request_v2(text,text,text,text,text,text,text,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_eesy_mobile_request(text,text,text,text,text,text) FROM authenticated;
COMMENT ON FUNCTION public.submit_eesy_mobile_request(text,text,text,text,text,text) IS 'DEPRECATED: erstattet af submit_eesy_mobile_request_v2';

CREATE OR REPLACE FUNCTION public.purge_eesy_mobile_sensitive()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.eesy_mobile_requests
  SET cpr_number = NULL, icc_number = NULL, address = NULL, phone_number = NULL,
      street = NULL, house_number = NULL, postal_code = NULL, city = NULL, sensitive_purged_at = now()
  WHERE status = 'sendt' AND sent_at < now() - interval '30 days' AND sensitive_purged_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.purge_eesy_mobile_sensitive() FROM PUBLIC, anon, authenticated;