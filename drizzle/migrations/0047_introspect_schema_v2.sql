CREATE OR REPLACE FUNCTION public.introspect_schema_v2()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
WITH sch AS (
  SELECT n.oid, n.nspname FROM pg_catalog.pg_namespace n
  WHERE n.nspname <> ALL (ARRAY['pg_catalog','information_schema','pg_toast'])
    AND n.nspname NOT LIKE 'pg_temp%' AND n.nspname NOT LIKE 'pg_toast%'
)
SELECT public.introspect_schema() || pg_catalog.jsonb_build_object(
  'version', 2,
  'postgres_version', pg_catalog.current_setting('server_version'),
  'indexes', (
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', s.nspname, 'table', t.relname, 'name', ic.relname,
      'definition', pg_catalog.pg_get_indexdef(i.indexrelid),
      'unique', i.indisunique, 'primary', i.indisprimary, 'valid', i.indisvalid
    ) ORDER BY s.nspname, t.relname, ic.relname), '[]'::jsonb)
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
    JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
    JOIN sch s ON s.oid = t.relnamespace
    WHERE t.relkind IN ('r','p')
  ),
  'privileges', pg_catalog.jsonb_build_object(
    'tables', (
      SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'schema', s.nspname, 'table', c.relname,
        'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
        'privilege', a.privilege_type
      ) ORDER BY s.nspname, c.relname, a.grantee, a.privilege_type), '[]'::jsonb)
      FROM pg_catalog.pg_class c
      JOIN sch s ON s.oid = c.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
      WHERE c.relkind IN ('r','p','v','m','f')
    ),
    'columns', (
      SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'schema', s.nspname, 'table', c.relname, 'column', att.attname,
        'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
        'privilege', a.privilege_type
      ) ORDER BY s.nspname, c.relname, att.attnum, a.grantee, a.privilege_type), '[]'::jsonb)
      FROM pg_catalog.pg_attribute att
      JOIN pg_catalog.pg_class c ON c.oid = att.attrelid
      JOIN sch s ON s.oid = c.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(att.attacl) a
      WHERE att.attacl IS NOT NULL AND att.attnum > 0 AND NOT att.attisdropped
    ),
    'functions', (
      SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'schema', s.nspname, 'function', p.proname,
        'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
        'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END
      ) ORDER BY s.nspname, p.proname, a.grantee), '[]'::jsonb)
      FROM pg_catalog.pg_proc p
      JOIN sch s ON s.oid = p.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    ),
    'schemas', (
      SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'schema', n.nspname,
        'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
        'privilege', a.privilege_type
      ) ORDER BY n.nspname, a.grantee, a.privilege_type), '[]'::jsonb)
      FROM pg_catalog.pg_namespace n
      JOIN sch s ON s.oid = n.oid
      CROSS JOIN LATERAL pg_catalog.aclexplode(n.nspacl) a
      WHERE n.nspacl IS NOT NULL
    ),
    'defaults', (
      SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'role', pg_catalog.pg_get_userbyid(d.defaclrole),
        'schema', n.nspname,
        'object_type', d.defaclobjtype::text,
        'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
        'privilege', a.privilege_type
      )), '[]'::jsonb)
      FROM pg_catalog.pg_default_acl d
      LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
    )
  ),
  'event_triggers', (
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', e.evtname, 'event', e.evtevent, 'enabled', e.evtenabled::text,
      'function', pn.nspname || '.' || p.proname, 'tags', e.evttags
    ) ORDER BY e.evtname), '[]'::jsonb)
    FROM pg_catalog.pg_event_trigger e
    JOIN pg_catalog.pg_proc p ON p.oid = e.evtfoid
    JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
  ),
  'roles', (
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', r.rolname, 'login', r.rolcanlogin, 'superuser', r.rolsuper,
      'bypassrls', r.rolbypassrls, 'inherit', r.rolinherit,
      'createrole', r.rolcreaterole, 'createdb', r.rolcreatedb,
      'connection_limit', r.rolconnlimit,
      'member_of', (
        SELECT coalesce(pg_catalog.jsonb_agg(g.rolname ORDER BY g.rolname), '[]'::jsonb)
        FROM pg_catalog.pg_auth_members m
        JOIN pg_catalog.pg_roles g ON g.oid = m.roleid
        WHERE m.member = r.oid
      )
    ) ORDER BY r.rolname), '[]'::jsonb)
    FROM pg_catalog.pg_roles r
    WHERE r.rolname NOT LIKE 'pg\_%'
  ),
  'extensions', (
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', x.extname, 'version', x.extversion, 'schema', n.nspname
    ) ORDER BY x.extname), '[]'::jsonb)
    FROM pg_catalog.pg_extension x
    JOIN pg_catalog.pg_namespace n ON n.oid = x.extnamespace
  )
);
$fn$;

REVOKE ALL ON FUNCTION public.introspect_schema_v2() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.introspect_schema_v2() TO service_role;