-- IP-intervaller for EU/EØS (DB-IP Lite, CC BY 4.0). Kun lande, ingen persondata.
CREATE TABLE public.eea_ip_ranges (
  ip_start inet NOT NULL,
  ip_end inet NOT NULL,
  country text NOT NULL,
  batch text NOT NULL
);
GRANT ALL ON public.eea_ip_ranges TO service_role;
ALTER TABLE public.eea_ip_ranges ENABLE ROW LEVEL SECURITY;
CREATE INDEX eea_ip_ranges_start_idx ON public.eea_ip_ranges (ip_start);

-- Afviste logins: kun bruger-id og årsag, ingen IP-adresse.
CREATE TABLE public.geo_login_denials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.geo_login_denials TO authenticated;
GRANT ALL ON public.geo_login_denials TO service_role;
ALTER TABLE public.geo_login_denials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin kan se afviste geo-logins" ON public.geo_login_denials
  FOR SELECT TO authenticated USING (public.am_i_superadmin());

CREATE OR REPLACE FUNCTION public.geo_ip_in_eea(_ip text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v inet; r record;
BEGIN
  BEGIN v := _ip::inet; EXCEPTION WHEN others THEN RETURN NULL; END;
  SELECT ip_end, country INTO r FROM public.eea_ip_ranges
   WHERE ip_start <= v AND family(ip_start) = family(v)
   ORDER BY ip_start DESC LIMIT 1;
  IF r IS NULL OR v > r.ip_end THEN RETURN NULL; END IF;
  RETURN r.country;
END $$;
REVOKE ALL ON FUNCTION public.geo_ip_in_eea(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.geo_ip_in_eea(text) TO service_role;

CREATE OR REPLACE FUNCTION public.geo_eea_activate_batch(_batch text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.eea_ip_ranges WHERE batch = _batch;
  IF n < 100000 THEN RAISE EXCEPTION 'Batch for lille (%), aktiveres ikke', n; END IF;
  DELETE FROM public.eea_ip_ranges WHERE batch <> _batch;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.geo_eea_activate_batch(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.geo_eea_activate_batch(text) TO service_role;

SELECT cron.schedule(
  'refresh-eea-ip-ranges',
  '0 4 3 * *',
  $cron$
    SELECT net.http_post(
      url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/refresh-eea-ip-ranges',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM private.internal_secrets WHERE name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) AS request_id;
  $cron$
);