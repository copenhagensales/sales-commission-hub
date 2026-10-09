ALTER TABLE public.ramp_settings ADD COLUMN IF NOT EXISTS weekly_min_targets jsonb NOT NULL DEFAULT '[5,8,11,14,17]'::jsonb;

CREATE OR REPLACE FUNCTION public.get_ramp_weekly_min_targets()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.can_view_ramp_team() OR public.is_superadmin(auth.uid())
    THEN (SELECT weekly_min_targets FROM public.ramp_settings ORDER BY created_at LIMIT 1) END;
$$;

CREATE OR REPLACE FUNCTION public.set_ramp_weekly_min_targets(_targets jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Kun ejere kan ændre minimumskrav'; END IF;
  IF jsonb_typeof(_targets) <> 'array' OR jsonb_array_length(_targets) < 1 OR jsonb_array_length(_targets) > 8 THEN
    RAISE EXCEPTION 'Ugyldige minimumskrav'; END IF;
  FOR v IN SELECT * FROM jsonb_array_elements(_targets) LOOP
    IF jsonb_typeof(v) <> 'number' OR (v::text)::numeric < 0 OR (v::text)::numeric <> trunc((v::text)::numeric) THEN
      RAISE EXCEPTION 'Minimumskrav skal være hele tal ≥ 0'; END IF;
  END LOOP;
  UPDATE public.ramp_settings SET weekly_min_targets = _targets, updated_at = now();
END; $$;

REVOKE ALL ON FUNCTION public.get_ramp_weekly_min_targets() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_ramp_weekly_min_targets(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ramp_weekly_min_targets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_ramp_weekly_min_targets(jsonb) TO authenticated;