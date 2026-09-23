REVOKE ALL ON FUNCTION public.get_ramp_full_team() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ramp_full_team() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_ramp_full_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ramp_full_team() TO service_role;