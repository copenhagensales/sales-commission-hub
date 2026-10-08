-- IP-intervaller for lande UDEN for EU/EØS (DB-IP Lite, CC BY 4.0). Kun lande, ingen persondata.
-- Bruges til kun at afvise logins, der beviseligt kommer udefra; ukendte adresser lukkes ind.
CREATE TABLE public.non_eea_ip_ranges (
  ip_start inet NOT NULL,
  ip_end inet NOT NULL,
  country text NOT NULL
);
GRANT ALL ON public.non_eea_ip_ranges TO service_role;
ALTER TABLE public.non_eea_ip_ranges ENABLE ROW LEVEL SECURITY;
CREATE INDEX non_eea_ip_ranges_start_idx ON public.non_eea_ip_ranges (ip_start);

CREATE OR REPLACE FUNCTION public.geo_ip_outside_eea(_ip text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v inet; r record;
BEGIN
  BEGIN v := _ip::inet; EXCEPTION WHEN others THEN RETURN NULL; END;
  SELECT ip_end, country INTO r FROM public.non_eea_ip_ranges
   WHERE ip_start <= v AND family(ip_start) = family(v)
   ORDER BY ip_start DESC LIMIT 1;
  IF r IS NULL OR v > r.ip_end THEN RETURN NULL; END IF;
  RETURN r.country;
END $$;
REVOKE ALL ON FUNCTION public.geo_ip_outside_eea(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.geo_ip_outside_eea(text) TO service_role;