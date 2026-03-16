
-- league_rounds: one round per week
CREATE TABLE public.league_rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(season_id, round_number)
);

-- league_round_standings: per-player results per round
CREATE TABLE public.league_round_standings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.league_rounds(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  division INTEGER NOT NULL,
  rank_in_division INTEGER NOT NULL,
  weekly_provision NUMERIC NOT NULL DEFAULT 0,
  weekly_deals INTEGER NOT NULL DEFAULT 0,
  points_earned NUMERIC NOT NULL DEFAULT 0,
  cumulative_points NUMERIC NOT NULL DEFAULT 0,
  movement TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_id, employee_id)
);

-- league_season_standings: cumulative standings
CREATE TABLE public.league_season_standings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  current_division INTEGER NOT NULL DEFAULT 1,
  total_points NUMERIC NOT NULL DEFAULT 0,
  total_provision NUMERIC NOT NULL DEFAULT 0,
  rounds_played INTEGER NOT NULL DEFAULT 0,
  overall_rank INTEGER NOT NULL DEFAULT 0,
  division_rank INTEGER NOT NULL DEFAULT 0,
  previous_division INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(season_id, employee_id)
);

-- RLS
ALTER TABLE public.league_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_round_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_season_standings ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated users
CREATE POLICY "Authenticated users can read league_rounds" ON public.league_rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read league_round_standings" ON public.league_round_standings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read league_season_standings" ON public.league_season_standings FOR SELECT TO authenticated USING (true);

-- Service role write policies
CREATE POLICY "Service role can manage league_rounds" ON public.league_rounds FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage league_round_standings" ON public.league_round_standings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage league_season_standings" ON public.league_season_standings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime on season standings
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_season_standings;
