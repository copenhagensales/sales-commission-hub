DO $mig$
DECLARE
  d text := pg_get_functiondef('public.get_ramp_team_overview'::regproc);
  old text := $x$a.employment_end_date, v_monday) AS last_week_status,$x$;
BEGIN
  IF position(old in d) = 0 THEN
    RAISE EXCEPTION 'last_week_status line not found';
  END IF;
  d := replace(d, old, $x$a.employment_end_date, v_monday - 1) AS last_week_status,$x$);
  EXECUTE d;
END
$mig$;
COMMENT ON FUNCTION public.get_ramp_team_overview() IS 'Opstart-oversigt. last_week_status = ramp_week_status maalt pr. sidste soendag (sidste uges slutresultat), kun til mandagsvisning.';