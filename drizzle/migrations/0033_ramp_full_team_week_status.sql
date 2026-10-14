DO $m$
DECLARE d text; old text := $x$'start_date', d.real_start_date
$x$;
BEGIN
  d := pg_get_functiondef('public.get_ramp_full_team()'::regprocedure);
  IF position(old in d) = 0 THEN RAISE EXCEPTION 'start_date line not found'; END IF;
  d := replace(d, old, $x$'start_date', d.real_start_date,
           'week_status', CASE WHEN coalesce(d.real_start_date, v_today) <= v_today - 1 THEN public.ramp_week_status(d.start_date, d.campaign_ids, d.email, d.employment_end_date, v_today) END,
           'last_week_status', CASE WHEN coalesce(d.real_start_date, v_today) < v_monday THEN public.ramp_week_status(d.start_date, d.campaign_ids, d.email, d.employment_end_date, v_monday - 1) END
$x$);
  EXECUTE d;
END $m$;
COMMENT ON FUNCTION public.get_ramp_full_team() IS 'Etablerede saelgere. week_status/last_week_status = ramp_week_status (krav = sidste opstartskrav).';