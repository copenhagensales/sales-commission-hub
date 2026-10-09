CREATE OR REPLACE FUNCTION public.can_edit_ramp_min_targets()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.effective_is_owner(), false) OR coalesce(public.is_superadmin(auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.can_edit_ramp_min_targets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_ramp_min_targets() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_ramp_weekly_min_targets(_targets jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.can_edit_ramp_min_targets() THEN RAISE EXCEPTION 'Kun ejere kan ændre minimumskrav'; END IF;
  IF jsonb_typeof(_targets) <> 'array' OR jsonb_array_length(_targets) < 1 OR jsonb_array_length(_targets) > 8 THEN
    RAISE EXCEPTION 'Ugyldige minimumskrav'; END IF;
  FOR v IN SELECT * FROM jsonb_array_elements(_targets) LOOP
    IF jsonb_typeof(v) <> 'number' OR (v::text)::numeric < 0 OR (v::text)::numeric <> trunc((v::text)::numeric) THEN
      RAISE EXCEPTION 'Minimumskrav skal være hele tal ≥ 0'; END IF;
  END LOOP;
  UPDATE public.ramp_settings SET weekly_min_targets = _targets, updated_at = now();
END; $$;