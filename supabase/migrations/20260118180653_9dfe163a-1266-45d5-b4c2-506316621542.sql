-- Create team_expenses table for tracking team costs
CREATE TABLE public.team_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL,
  category TEXT, -- 'konkurrence', 'præmie', 'bonus', 'andet'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.team_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policy for owners
CREATE POLICY "owners_full_access" ON public.team_expenses
  FOR ALL USING (is_owner(auth.uid()));