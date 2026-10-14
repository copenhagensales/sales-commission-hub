DO $mig$
DECLARE
  d text := pg_get_functiondef('public.get_ramp_team_overview'::regproc);
BEGIN
  d := replace(d,
    $x$a.employment_end_date, v_today) AS week_status,$x$,
    $x$a.employment_end_date, v_today) AS week_status,
           public.ramp_week_status(a.start_date, a.campaign_ids, a.email, a.employment_end_date, v_monday) AS last_week_status,$x$);
  d := replace(d,
    $x$'week_status', d.week_status$x$,
    $x$'week_status', d.week_status,
           'last_week_status', d.last_week_status$x$);
  IF (length(d) - length(replace(d, 'last_week_status', ''))) / length('last_week_status') <> 3 THEN
    RAISE EXCEPTION 'get_ramp_team_overview patch did not apply cleanly';
  END IF;
  EXECUTE d;
END
$mig$;
COMMENT ON FUNCTION public.get_ramp_team_overview() IS 'Opstart-oversigt. last_week_status = ramp_week_status maalt pr. denne mandag (sidste uges slutresultat), kun til mandagsvisning.';