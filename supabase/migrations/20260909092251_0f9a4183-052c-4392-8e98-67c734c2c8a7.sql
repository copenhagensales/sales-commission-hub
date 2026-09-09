CREATE TABLE public.auth_account_merge_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID,
  employee_name TEXT,
  duplicate_user_id UUID NOT NULL,
  duplicate_email TEXT,
  kept_user_id UUID NOT NULL,
  kept_email_before TEXT,
  kept_email_after TEXT,
  login_events_moved INTEGER NOT NULL DEFAULT 0,
  sensitive_access_moved INTEGER NOT NULL DEFAULT 0,
  roles_moved INTEGER NOT NULL DEFAULT 0,
  roles_deleted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auth_account_merge_log TO authenticated;
GRANT ALL ON public.auth_account_merge_log TO service_role;

ALTER TABLE public.auth_account_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read auth account merge log"
ON public.auth_account_merge_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.am_i_superadmin());

CREATE OR REPLACE FUNCTION public.find_auth_uuid_references(_uids uuid[])
RETURNS TABLE (uid uuid, ref_table text, ref_column text, ref_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  q TEXT;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
     AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.data_type = 'uuid'
      AND NOT (c.table_name = 'login_events' AND c.column_name = 'user_id')
      AND NOT (c.table_name = 'sensitive_data_access_log' AND c.column_name = 'user_id')
      AND NOT (c.table_name = 'system_roles' AND c.column_name = 'user_id')
      AND c.table_name <> 'auth_account_merge_log'
  LOOP
    q := format(
      'SELECT x.v AS uid, %L::text AS ref_table, %L::text AS ref_column, count(*) AS ref_count
         FROM unnest($1) AS x(v)
         JOIN public.%I t ON t.%I = x.v
        GROUP BY x.v',
      r.table_name, r.column_name, r.table_name, r.column_name
    );
    RETURN QUERY EXECUTE q USING _uids;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.find_auth_uuid_references(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_auth_uuid_references(uuid[]) TO service_role;