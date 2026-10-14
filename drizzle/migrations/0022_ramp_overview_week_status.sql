DO $do$
DECLARE v text := pg_get_functiondef('public.get_ramp_team_overview()'::regprocedure);
BEGIN
  IF position('week_status' IN v) > 0 THEN RETURN; END IF;
  v := replace(v, 'ORDER BY t.name LIMIT 1) AS team_name,',
    'ORDER BY t.name LIMIT 1) AS team_name,
           public.ramp_week_status(a.start_date, a.campaign_ids, a.email, a.employment_end_date, v_today) AS week_status,');
  v := replace(v, '''actions'', d.actions', '''actions'', d.actions,
           ''week_status'', d.week_status');
  IF position('d.week_status' IN v) = 0 OR position('AS week_status' IN v) = 0 THEN
    RAISE EXCEPTION 'get_ramp_team_overview: tekstudskiftning fejlede';
  END IF;
  EXECUTE v;
END
$do$;