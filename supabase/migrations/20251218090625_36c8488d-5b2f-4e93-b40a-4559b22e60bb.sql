-- Create team monthly goals table
CREATE TABLE public.team_monthly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  sales_target INTEGER NOT NULL DEFAULT 0,
  bonus_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, month, year)
);

-- Enable RLS
ALTER TABLE public.team_monthly_goals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view goals for their team
CREATE POLICY "Users can view their team goals"
ON public.team_monthly_goals
FOR SELECT
USING (
  team_id IN (
    SELECT tm.team_id FROM team_members tm
    JOIN employee_master_data emd ON tm.employee_id = emd.id
    WHERE emd.id = get_current_employee_id()
  )
);

-- Owners can manage all team goals
CREATE POLICY "Owners can manage all team goals"
ON public.team_monthly_goals
FOR ALL
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

-- Team leaders can manage their team goals
CREATE POLICY "Team leaders can manage their team goals"
ON public.team_monthly_goals
FOR ALL
USING (
  is_teamleder_or_above(auth.uid()) AND
  team_id IN (
    SELECT tm.team_id FROM team_members tm
    JOIN employee_master_data emd ON tm.employee_id = emd.id
    WHERE emd.id = get_current_employee_id()
  )
)
WITH CHECK (
  is_teamleder_or_above(auth.uid()) AND
  team_id IN (
    SELECT tm.team_id FROM team_members tm
    JOIN employee_master_data emd ON tm.employee_id = emd.id
    WHERE emd.id = get_current_employee_id()
  )
);