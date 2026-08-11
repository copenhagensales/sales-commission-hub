REVOKE ALL ON FUNCTION public.league_resolve_employee_from_agent_email(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.league_current_open_season() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.league_enroll_from_sales(uuid, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_enroll_from_sales(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_current_open_season() TO service_role;
GRANT EXECUTE ON FUNCTION public.league_resolve_employee_from_agent_email(text) TO service_role;