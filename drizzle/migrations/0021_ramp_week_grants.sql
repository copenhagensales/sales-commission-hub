GRANT EXECUTE ON FUNCTION public.ramp_week_status(date, uuid[], text, date, date) TO service_role, supabase_read_only_user;
GRANT EXECUTE ON FUNCTION public.ramp_risk_flag_candidates(date) TO service_role, supabase_read_only_user;
GRANT EXECUTE ON FUNCTION public.ramp_week_target(int) TO service_role, supabase_read_only_user;