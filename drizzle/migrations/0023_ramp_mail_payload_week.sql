DO $do$
DECLARE v text := pg_get_functiondef('public.ramp_risk_mail_payload()'::regprocedure);
BEGIN
  IF position('week_required' IN v) > 0 THEN RETURN; END IF;
  v := replace(v, 'f.day_no, f.cum_sales, f.threshold_value, f.created_at',
                  'f.day_no, f.cum_sales, f.threshold_value, f.created_at, f.model, f.week_required');
  v := replace(v, '''created_at'', o.created_at', '''created_at'', o.created_at,
                 ''model'', o.model,
                 ''week_required'', o.week_required');
  IF position('o.week_required' IN v) = 0 OR position('f.week_required' IN v) = 0 THEN
    RAISE EXCEPTION 'ramp_risk_mail_payload: tekstudskiftning fejlede';
  END IF;
  EXECUTE v;
END
$do$;