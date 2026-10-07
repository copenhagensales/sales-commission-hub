CREATE OR REPLACE FUNCTION public.introspect_schema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  result jsonb;
  cron_jobs jsonb := '[]'::jsonb;
  sys_schemas text[] := ARRAY['pg_catalog','information_schema','pg_toast'];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $q$SELECT coalesce(jsonb_agg(jsonb_build_object(
        'jobid', jobid, 'name', jobname, 'schedule', schedule,
        'command', command, 'active', active) ORDER BY jobname), '[]'::jsonb)
      FROM cron.job$q$ INTO cron_jobs;
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'tables', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'schema', n.nspname,
        'name', c.relname,
        'kind', c.relkind::text,
        'rls_enabled', c.relrowsecurity,
        'rls_forced', c.relforcerowsecurity,
        'estimated_rows', c.reltuples::bigint,
        'comment', obj_description(c.oid, 'pg_class'),
        'columns', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'name', a.attname,
            'type', format_type(a.atttypid, a.atttypmod),
            'nullable', NOT a.attnotnull,
            'default', pg_get_expr(d.adbin, d.adrelid),
            'comment', col_description(c.oid, a.attnum)
          ) ORDER BY a.attnum), '[]'::jsonb)
          FROM pg_attribute a
          LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        )
      ) ORDER BY n.nspname, c.relname), '[]'::jsonb)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','p')
        AND n.nspname <> ALL (sys_schemas)
        AND n.nspname NOT LIKE 'pg_temp%' AND n.nspname NOT LIKE 'pg_toast%'
    ),
    'policies', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'schema', schemaname, 'table', tablename, 'name', policyname,
        'permissive', permissive, 'roles', roles, 'command', cmd,
        'using', qual, 'with_check', with_check
      ) ORDER BY schemaname, tablename, policyname), '[]'::jsonb)
      FROM pg_policies
    ),
    'triggers', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'schema', n.nspname, 'table', c.relname, 'name', t.tgname,
        'timing', CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
                       WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF' ELSE 'AFTER' END,
        'events', array_remove(ARRAY[
          CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
          CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
          CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END,
          CASE WHEN t.tgtype & 32 = 32 THEN 'TRUNCATE' END], NULL),
        'level', CASE WHEN t.tgtype & 1 = 1 THEN 'ROW' ELSE 'STATEMENT' END,
        'function', pn.nspname || '.' || p.proname,
        'enabled', t.tgenabled::text,
        'definition', pg_get_triggerdef(t.oid)
      ) ORDER BY n.nspname, c.relname, t.tgname), '[]'::jsonb)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace pn ON pn.oid = p.pronamespace
      WHERE NOT t.tgisinternal AND n.nspname <> ALL (sys_schemas)
    ),
    'functions', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'kind', p.prokind::text,
        'arguments', pg_get_function_arguments(p.oid),
        'returns', pg_get_function_result(p.oid),
        'security_definer', p.prosecdef,
        'search_path', (SELECT string_agg(cfg, ', ') FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'),
        'definition', pg_get_functiondef(p.oid)
      ) ORDER BY p.proname, pg_get_function_arguments(p.oid)), '[]'::jsonb)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
    ),
    'constraints', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'schema', n.nspname, 'table', c.relname, 'name', con.conname,
        'type', CASE con.contype WHEN 'f' THEN 'FOREIGN KEY' WHEN 'u' THEN 'UNIQUE'
                                 WHEN 'c' THEN 'CHECK' WHEN 'p' THEN 'PRIMARY KEY' END,
        'definition', pg_get_constraintdef(con.oid)
      ) ORDER BY n.nspname, c.relname, con.conname), '[]'::jsonb)
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE con.contype IN ('f','u','c','p') AND n.nspname <> ALL (sys_schemas)
    ),
    'views', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'schema', n.nspname, 'name', c.relname,
        'materialized', c.relkind = 'm',
        'definition', pg_get_viewdef(c.oid, true)
      ) ORDER BY n.nspname, c.relname), '[]'::jsonb)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('v','m') AND n.nspname <> ALL (sys_schemas)
    ),
    'table_privileges', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'schema', table_schema, 'table', table_name,
        'grantee', grantee, 'privilege', privilege_type
      ) ORDER BY table_schema, table_name, grantee, privilege_type), '[]'::jsonb)
      FROM information_schema.role_table_grants
      WHERE grantee IN ('anon','authenticated')
    ),
    'function_privileges', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'function', p.proname, 'arguments', pg_get_function_identity_arguments(p.oid),
        'grantee', r.rolname,
        'execute', has_function_privilege(r.oid, p.oid, 'EXECUTE')
      ) ORDER BY p.proname, r.rolname), '[]'::jsonb)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN pg_roles r
      WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
        AND r.rolname IN ('anon','authenticated')
    ),
    'cron_jobs', cron_jobs
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.introspect_schema() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.introspect_schema() TO service_role;