-- Apple iCloud Privat videresendelse: relæadresser med brugerens reelle land (kun EU/EØS). Ingen persondata.
CREATE TABLE IF NOT EXISTS public.apple_relay_eea_ranges (net cidr PRIMARY KEY, country text NOT NULL, loaded_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.apple_relay_eea_ranges TO service_role;
REVOKE ALL ON public.apple_relay_eea_ranges FROM anon, authenticated;
ALTER TABLE public.apple_relay_eea_ranges ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS apple_relay_eea_ranges_net_gist ON public.apple_relay_eea_ranges USING gist (net inet_ops);

CREATE OR REPLACE FUNCTION public.geo_ip_in_eea(_ip text)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v inet; r record; a text;
BEGIN
  BEGIN v := _ip::inet; EXCEPTION WHEN others THEN RETURN NULL; END;
  -- Apple-relæ: brug Apples oplyste land for brugeren.
  SELECT country INTO a FROM public.apple_relay_eea_ranges WHERE net >>= v LIMIT 1;
  IF a IS NOT NULL THEN RETURN a; END IF;
  SELECT ip_end, country INTO r FROM public.eea_ip_ranges
   WHERE ip_start <= v AND family(ip_start) = family(v)
   ORDER BY ip_start DESC LIMIT 1;
  IF r IS NULL OR v > r.ip_end THEN RETURN NULL; END IF;
  RETURN r.country;
END $function$;