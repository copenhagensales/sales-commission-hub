-- Udvid h2h_challenges med resultat-felter
ALTER TABLE h2h_challenges ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE h2h_challenges ADD COLUMN IF NOT EXISTS winner_employee_id UUID REFERENCES employee_master_data(id);
ALTER TABLE h2h_challenges ADD COLUMN IF NOT EXISTS challenger_final_commission NUMERIC DEFAULT 0;
ALTER TABLE h2h_challenges ADD COLUMN IF NOT EXISTS opponent_final_commission NUMERIC DEFAULT 0;
ALTER TABLE h2h_challenges ADD COLUMN IF NOT EXISTS challenger_final_sales INTEGER DEFAULT 0;
ALTER TABLE h2h_challenges ADD COLUMN IF NOT EXISTS opponent_final_sales INTEGER DEFAULT 0;
ALTER TABLE h2h_challenges ADD COLUMN IF NOT EXISTS is_draw BOOLEAN DEFAULT false;

-- Opret H2H employee stats tabel for samlet historik og streaks
CREATE TABLE IF NOT EXISTS h2h_employee_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_master_data(id),
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  current_win_streak INTEGER DEFAULT 0,
  longest_win_streak INTEGER DEFAULT 0,
  total_commission_earned NUMERIC DEFAULT 0,
  elo_rating INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id)
);

-- Enable RLS
ALTER TABLE h2h_employee_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for h2h_employee_stats
CREATE POLICY "Users can view all stats" ON h2h_employee_stats
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own stats" ON h2h_employee_stats
  FOR INSERT WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Users can update own stats" ON h2h_employee_stats
  FOR UPDATE USING (employee_id = get_current_employee_id());

-- Allow participants to update challenge results
CREATE POLICY "Participants can update completed challenges" ON h2h_challenges
  FOR UPDATE USING (
    (challenger_employee_id = get_current_employee_id() OR opponent_employee_id = get_current_employee_id())
    AND status = 'accepted'
  );