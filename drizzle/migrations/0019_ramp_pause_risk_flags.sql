ALTER TABLE public.ramp_settings ADD COLUMN IF NOT EXISTS risk_flags_paused boolean NOT NULL DEFAULT false;
UPDATE public.ramp_settings SET risk_flags_paused = true;
ALTER FUNCTION public.ramp_create_risk_flags() RENAME TO ramp_create_risk_flags_cumulative;
COMMENT ON FUNCTION public.ramp_create_risk_flags_cumulative() IS 'DEPRECATED: samlet model, erstattes af ugemodel';
CREATE OR REPLACE FUNCTION public.ramp_create_risk_flags()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ramp_settings WHERE risk_flags_paused) THEN
    RETURN 0;
  END IF;
  RETURN 0; -- ugemodellen indsættes her; samlet model er udfaset
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ramp_create_risk_flags_cumulative() FROM PUBLIC, anon, authenticated;