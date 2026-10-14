DO $mig$
DECLARE
  d text := pg_get_functiondef('public.get_ramp_team_overview'::regproc);
BEGIN
  IF position($x$'focus_area', ac.focus_area$x$ in d) > 0 THEN RETURN; END IF;
  d := replace(d,
    $x$'note', ac.note,$x$,
    $x$'note', ac.note,
                      'focus_area', ac.focus_area,$x$);
  IF position($x$'focus_area', ac.focus_area$x$ in d) = 0 THEN
    RAISE EXCEPTION 'get_ramp_team_overview focus_area patch did not apply';
  END IF;
  EXECUTE d;
END
$mig$;