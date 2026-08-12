CREATE OR REPLACE FUNCTION public.is_active_employee(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _uid AND is_active = true
  )
$$;

REVOKE ALL ON FUNCTION public.is_active_employee(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_employee(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_employee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_employee(uuid) TO service_role;

DROP POLICY IF EXISTS "Employees can view active colleagues" ON public.employee_master_data;

CREATE POLICY "Employees can view active colleagues"
ON public.employee_master_data
FOR SELECT
TO authenticated
USING (is_active = true AND public.is_active_employee(auth.uid()));

CREATE OR REPLACE FUNCTION public.check_rls_self_reference()
RETURNS TABLE(schema_name text, table_name text, policy_name text, command text, expression text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.schemaname::text,
         p.tablename::text,
         p.policyname::text,
         p.cmd::text,
         coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''))
        ~ ('(from|join)[[:space:]]+(public\.)?' || p.tablename || '([[:space:]]|$|\))')
$$;

REVOKE ALL ON FUNCTION public.check_rls_self_reference() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rls_self_reference() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_rls_self_reference() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rls_self_reference() TO service_role;