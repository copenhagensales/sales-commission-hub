CREATE OR REPLACE FUNCTION public.introspect_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
SET statement_timeout = '120s'
AS $$
DECLARE
  v_tables jsonb;
  v_monthly jsonb := '{}'::jsonb;
  v_logins jsonb;
  v_emp jsonb;
  v_stmts jsonb;
  v_cron jsonb;
  v_reset timestamptz;
  r record;
  v_m jsonb;
  v_since date := (date_trunc('month', now()) - interval '23 months')::date;
BEGIN
  SELECT stats_reset INTO v_reset FROM pg_stat_database WHERE datname = current_database();

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table', s.relname, 'live_rows', s.n_live_tup,
    'inserts', s.n_tup_ins, 'updates', s.n_tup_upd, 'deletes', s.n_tup_del,
    'total_bytes', pg_total_relation_size(s.relid)) ORDER BY s.relname), '[]'::jsonb)
  INTO v_tables FROM pg_stat_user_tables s WHERE s.schemaname = 'public';

  FOR r IN
    SELECT c.table_name, s.n_live_tup
    FROM information_schema.columns c
    JOIN pg_stat_user_tables s ON s.schemaname = 'public' AND s.relname = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'created_at'
      AND c.data_type IN ('timestamp with time zone','timestamp without time zone','date')
    ORDER BY c.table_name
  LOOP
    IF r.n_live_tup > 3000000 THEN
      v_monthly := v_monthly || jsonb_build_object(r.table_name, jsonb_build_object('skipped', true, 'live_rows', r.n_live_tup));
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format(
        'SELECT coalesce(jsonb_object_agg(m, n ORDER BY m), ''{}''::jsonb) FROM (
           SELECT to_char(date_trunc(''month'', created_at), ''YYYY-MM'') m, count(*) n
           FROM public.%I WHERE created_at >= $1 GROUP BY 1) x', r.table_name)
      INTO v_m USING v_since;
      v_monthly := v_monthly || jsonb_build_object(r.table_name, v_m);
    EXCEPTION WHEN OTHERS THEN
      v_monthly := v_monthly || jsonb_build_object(r.table_name, jsonb_build_object('error', SQLSTATE));
    END;
  END LOOP;

  SELECT coalesce(jsonb_agg(jsonb_build_object('month', m, 'logins', n, 'distinct_users', u) ORDER BY m), '[]'::jsonb)
  INTO v_logins FROM (
    SELECT to_char(date_trunc('month', logged_in_at), 'YYYY-MM') m, count(*) n, count(DISTINCT user_id) u
    FROM public.login_events WHERE logged_in_at >= v_since GROUP BY 1) x;

  SELECT coalesce(jsonb_agg(jsonb_build_object('is_active', is_active, 'job_title', job_title, 'department', department, 'count', n)
    ORDER BY is_active DESC, job_title, department), '[]'::jsonb)
  INTO v_emp FROM (
    SELECT is_active, job_title, department, count(*) n
    FROM public.employee_master_data GROUP BY 1,2,3) x;

  BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object('query', left(query, 300), 'calls', calls,
      'total_exec_time_ms', round(total_exec_time::numeric, 2), 'rows', rows) ORDER BY calls DESC), '[]'::jsonb)
    INTO v_stmts FROM (SELECT query, calls, total_exec_time, rows FROM extensions.pg_stat_statements
      ORDER BY calls DESC LIMIT 300) x;
  EXCEPTION WHEN OTHERS THEN v_stmts := jsonb_build_object('error', SQLSTATE);
  END;

  BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object('jobid', jobid, 'jobname', jobname, 'runs', runs, 'failures', fails) ORDER BY jobid), '[]'::jsonb)
    INTO v_cron FROM (
      SELECT d.jobid, j.jobname, count(*) runs, count(*) FILTER (WHERE d.status = 'failed') fails
      FROM cron.job_run_details d LEFT JOIN cron.job j ON j.jobid = d.jobid
      WHERE d.start_time >= now() - interval '7 days' GROUP BY d.jobid, j.jobname) x;
  EXCEPTION WHEN OTHERS THEN v_cron := jsonb_build_object('error', SQLSTATE);
  END;

  RETURN jsonb_build_object(
    'generated_at', now(), 'stats_reset', v_reset,
    'tables', v_tables, 'rows_created_per_month', v_monthly,
    'logins_per_month', v_logins, 'employees_grouped', v_emp,
    'top_statements', v_stmts, 'cron_last_7_days', v_cron);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.introspect_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.introspect_usage() TO service_role;