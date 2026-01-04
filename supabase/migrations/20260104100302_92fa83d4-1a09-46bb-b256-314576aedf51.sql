-- Create team_sales_goals table for amount-based team goals
CREATE TABLE public.team_sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(team_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.team_sales_goals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view team sales goals"
ON public.team_sales_goals
FOR SELECT
USING (true);

CREATE POLICY "Teamledere can manage their team sales goals"
ON public.team_sales_goals
FOR ALL
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

CREATE POLICY "Owners can manage all team sales goals"
ON public.team_sales_goals
FOR ALL
USING (is_owner(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_team_sales_goals_updated_at
BEFORE UPDATE ON public.team_sales_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();