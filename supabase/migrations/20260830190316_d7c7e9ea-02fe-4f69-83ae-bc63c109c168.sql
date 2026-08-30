REVOKE EXECUTE ON FUNCTION public.is_superadmin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.am_i_superadmin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_salary_access(uuid, text, text) FROM anon;