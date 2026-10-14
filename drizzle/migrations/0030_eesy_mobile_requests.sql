CREATE TABLE public.eesy_mobile_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employee_master_data(id),
  subscription text NOT NULL,
  full_name text NOT NULL,
  address text,
  cpr_number text,
  phone_number text,
  icc_number text,
  status text NOT NULL DEFAULT 'ny' CHECK (status IN ('ny','sendt')),
  sent_at timestamptz,
  sensitive_purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.eesy_mobile_requests IS 'Eesy 50% medarbejdertilbud. Én pr. medarbejder. CPR/ICC/adresse/telefon slettes 30 dage efter status sendt.';

GRANT SELECT, UPDATE ON public.eesy_mobile_requests TO authenticated;
GRANT ALL ON public.eesy_mobile_requests TO service_role;
ALTER TABLE public.eesy_mobile_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ejere ser Eesy-anmodninger" ON public.eesy_mobile_requests
  FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Ejere opdaterer Eesy-anmodninger" ON public.eesy_mobile_requests
  FOR UPDATE TO authenticated USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

-- Eneste kilde til de abonnementer, der kan vælges.
CREATE OR REPLACE FUNCTION public.eesy_mobile_subscriptions()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY[
    'Fri tale - 40GB (5G) + 20GB EU - 99 kr. (6 mdr. binding)',
    'Fri tale - 80GB (5G) + 25GB EU - 109 kr. (6 mdr. binding)',
    'Fri tale - 100GB (5G) + 40GB EU - 125 kr. (6 mdr. binding)',
    'Fri tale - 110GB (5G) + 30GB EU - 135 kr. (6 mdr. binding)',
    'Fri tale - 160GB (5G) + 30GB EU - 144 kr. (6 mdr. binding)',
    'Fri tale - Fri data (5G) 35GB EU - 177 kr. (6 mdr. binding)'
  ]
$$;
GRANT EXECUTE ON FUNCTION public.eesy_mobile_subscriptions() TO authenticated;

-- Medarbejderens egen status (uden følsomme felter).
CREATE OR REPLACE FUNCTION public.my_eesy_mobile_request()
RETURNS TABLE(subscription text, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.subscription, r.status, r.created_at FROM public.eesy_mobile_requests r
  WHERE r.employee_id = public.effective_employee_id()
$$;
GRANT EXECUTE ON FUNCTION public.my_eesy_mobile_request() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_eesy_mobile_request(
  _subscription text, _full_name text, _address text, _cpr text, _phone text, _icc text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _emp uuid; _id uuid; _cpr_c text; _phone_c text; _icc_c text;
BEGIN
  IF public.view_as_target() IS NOT NULL THEN RAISE EXCEPTION 'Kan ikke indsendes i "se som"-tilstand'; END IF;
  _emp := public.get_employee_id_for_user(auth.uid());
  IF _emp IS NULL THEN RAISE EXCEPTION 'Ingen medarbejderprofil fundet'; END IF;
  IF NOT (_subscription = ANY(public.eesy_mobile_subscriptions())) THEN RAISE EXCEPTION 'Ugyldigt abonnement'; END IF;
  _cpr_c := regexp_replace(coalesce(_cpr,''), '[^0-9]', '', 'g');
  _phone_c := regexp_replace(coalesce(_phone,''), '[^0-9]', '', 'g');
  _icc_c := regexp_replace(coalesce(_icc,''), '[^0-9]', '', 'g');
  IF length(trim(coalesce(_full_name,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Navn mangler'; END IF;
  IF length(trim(coalesce(_address,''))) NOT BETWEEN 5 AND 200 THEN RAISE EXCEPTION 'Adresse mangler'; END IF;
  IF length(_cpr_c) <> 10 THEN RAISE EXCEPTION 'CPR-nummer skal være 10 cifre'; END IF;
  IF length(_phone_c) <> 8 THEN RAISE EXCEPTION 'Telefonnummer skal være 8 cifre'; END IF;
  IF length(_icc_c) NOT BETWEEN 18 AND 22 THEN RAISE EXCEPTION 'ICC-nummer skal være 18-22 cifre'; END IF;
  IF EXISTS (SELECT 1 FROM public.eesy_mobile_requests WHERE employee_id = _emp) THEN
    RAISE EXCEPTION 'Du har allerede indsendt en anmodning (kun ét tilbud pr. medarbejder)';
  END IF;
  INSERT INTO public.eesy_mobile_requests(employee_id, subscription, full_name, address, cpr_number, phone_number, icc_number)
  VALUES (_emp, _subscription, trim(_full_name), trim(_address), _cpr_c, _phone_c, _icc_c)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.submit_eesy_mobile_request(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_eesy_mobile_request(text,text,text,text,text,text) TO authenticated;

-- Sletter følsomme felter 30 dage efter status sendt.
CREATE OR REPLACE FUNCTION public.purge_eesy_mobile_sensitive()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.eesy_mobile_requests
  SET cpr_number = NULL, icc_number = NULL, address = NULL, phone_number = NULL, sensitive_purged_at = now()
  WHERE status = 'sendt' AND sent_at < now() - interval '30 days' AND sensitive_purged_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.purge_eesy_mobile_sensitive() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('purge-eesy-mobile-sensitive', '15 3 * * *', $$SELECT public.purge_eesy_mobile_sensitive()$$);