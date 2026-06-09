-- Allow anonymous (TV-board) read access to KPI cache tables
GRANT SELECT ON public.kpi_cached_values TO anon;
GRANT SELECT ON public.kpi_leaderboard_cache TO anon;

CREATE POLICY "Anon can view cached KPI values"
  ON public.kpi_cached_values
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can view leaderboard cache"
  ON public.kpi_leaderboard_cache
  FOR SELECT
  TO anon
  USING (true);