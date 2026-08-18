REVOKE EXECUTE ON FUNCTION public.get_league_team_provision(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_league_team_provision(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_league_team_provision(timestamptz, timestamptz) TO authenticated;