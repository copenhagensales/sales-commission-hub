-- Create kpi_leaderboard_cache table for pre-sorted leaderboard data
CREATE TABLE public.kpi_leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL, -- 'today', 'this_week', 'this_month', 'payroll_period'
  scope_type TEXT NOT NULL DEFAULT 'global', -- 'global', 'client', 'team'
  scope_id UUID, -- client_id or team_id (NULL for global)
  leaderboard_data JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of top 30 sellers
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_type, scope_type, scope_id)
);

-- Add index for fast lookups
CREATE INDEX idx_leaderboard_cache_lookup ON kpi_leaderboard_cache(period_type, scope_type, scope_id);

-- Enable RLS
ALTER TABLE kpi_leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (leaderboards are public data)
CREATE POLICY "Anyone can view leaderboard cache"
  ON kpi_leaderboard_cache
  FOR SELECT
  USING (true);

-- Only service role can insert/update (via edge function)
CREATE POLICY "Service role can manage leaderboard cache"
  ON kpi_leaderboard_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add update trigger for updated_at
CREATE TRIGGER update_kpi_leaderboard_cache_updated_at
  BEFORE UPDATE ON kpi_leaderboard_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE kpi_leaderboard_cache IS 'Pre-computed leaderboard data for fast dashboard loading';