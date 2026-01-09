
-- Provisionsliga: Kvalifikations-system (standalone)

-- Sæsoner med kvalifikationsperiode
CREATE TABLE league_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_number INT NOT NULL,
  qualification_start_at TIMESTAMPTZ NOT NULL,
  qualification_end_at TIMESTAMPTZ NOT NULL,
  qualification_source_start TIMESTAMPTZ NOT NULL,
  qualification_source_end TIMESTAMPTZ NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'qualification' CHECK (status IN ('draft', 'qualification', 'active', 'completed')),
  config JSONB DEFAULT '{"division_bonus_base": 18, "division_bonus_step": 5, "round_end_hour": 18, "players_per_division": 10}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tilmeldinger til sæson
CREATE TABLE league_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_master_data(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(employee_id, season_id)
);

-- Live kvalifikations-stillinger
CREATE TABLE league_qualification_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employee_master_data(id) ON DELETE CASCADE,
  current_provision NUMERIC DEFAULT 0,
  deals_count INT DEFAULT 0,
  projected_division INT NOT NULL DEFAULT 1,
  projected_rank INT NOT NULL DEFAULT 1,
  overall_rank INT NOT NULL DEFAULT 1,
  previous_overall_rank INT,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, employee_id)
);

-- Enable RLS
ALTER TABLE league_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_qualification_standings ENABLE ROW LEVEL SECURITY;

-- RLS for league_seasons
CREATE POLICY "Anyone can view seasons"
  ON league_seasons FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage seasons"
  ON league_seasons FOR ALL
  USING (is_owner(auth.uid()) OR is_teamleder_or_above(auth.uid()));

-- RLS for league_enrollments
CREATE POLICY "Users can view all enrollments"
  ON league_enrollments FOR SELECT
  USING (true);

CREATE POLICY "Users can enroll themselves"
  ON league_enrollments FOR INSERT
  WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Users can update own enrollment"
  ON league_enrollments FOR UPDATE
  USING (employee_id = get_current_employee_id());

-- RLS for league_qualification_standings
CREATE POLICY "Anyone can view qualification standings"
  ON league_qualification_standings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage standings"
  ON league_qualification_standings FOR ALL
  USING (is_owner(auth.uid()) OR is_teamleder_or_above(auth.uid()));

-- Indexes
CREATE INDEX idx_league_seasons_status ON league_seasons(status);
CREATE INDEX idx_league_seasons_active ON league_seasons(is_active);
CREATE INDEX idx_league_enrollments_season ON league_enrollments(season_id);
CREATE INDEX idx_league_enrollments_employee ON league_enrollments(employee_id);
CREATE INDEX idx_league_qualification_season ON league_qualification_standings(season_id);
CREATE INDEX idx_league_qualification_rank ON league_qualification_standings(season_id, overall_rank);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE league_qualification_standings;

-- Trigger for updated_at
CREATE TRIGGER update_league_seasons_updated_at
  BEFORE UPDATE ON league_seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
