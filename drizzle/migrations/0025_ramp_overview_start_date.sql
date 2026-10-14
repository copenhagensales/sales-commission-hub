DO $mig$
DECLARE
  d text := pg_get_functiondef('public.get_ramp_team_overview'::regproc);
BEGIN
  IF position($x$'start_date', d.start_date$x$ in d) > 0 THEN RETURN; END IF;
  d := replace(d,
    $x$    SELECT a.employee_id,
           a.employee_name,
           a.day_no,$x$,
    $x$    SELECT a.employee_id,
           a.employee_name,
           a.start_date,
           a.day_no,$x$);
  d := replace(d,
    $x$'last_week_status', d.last_week_status$x$,
    $x$'last_week_status', d.last_week_status,
           'start_date', d.start_date$x$);
  IF position($x$'start_date', d.start_date$x$ in d) = 0 OR position('a.start_date,
           a.day_no' in d) = 0 THEN
    RAISE EXCEPTION 'get_ramp_team_overview start_date patch did not apply cleanly';
  END IF;
  EXECUTE d;
END
$mig$;