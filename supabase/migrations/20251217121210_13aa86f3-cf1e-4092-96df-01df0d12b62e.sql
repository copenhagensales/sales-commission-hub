
-- Create head_to_head_battles table to track completed matchups
CREATE TABLE public.head_to_head_battles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  opponent_employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  challenger_wins INTEGER NOT NULL DEFAULT 0,
  opponent_wins INTEGER NOT NULL DEFAULT 0,
  challenger_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  opponent_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  winner_employee_id UUID REFERENCES public.employee_master_data(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.head_to_head_battles ENABLE ROW LEVEL SECURITY;

-- Employees can view battles they're part of
CREATE POLICY "Employees can view their battles"
ON public.head_to_head_battles
FOR SELECT
USING (
  challenger_employee_id = get_current_employee_id() 
  OR opponent_employee_id = get_current_employee_id()
);

-- Employees can create battles where they are the challenger
CREATE POLICY "Employees can create their battles"
ON public.head_to_head_battles
FOR INSERT
WITH CHECK (challenger_employee_id = get_current_employee_id());

-- Employees can update their own battles
CREATE POLICY "Employees can update their battles"
ON public.head_to_head_battles
FOR UPDATE
USING (challenger_employee_id = get_current_employee_id());

-- Create indexes for performance
CREATE INDEX idx_h2h_challenger ON public.head_to_head_battles(challenger_employee_id);
CREATE INDEX idx_h2h_opponent ON public.head_to_head_battles(opponent_employee_id);
CREATE INDEX idx_h2h_period ON public.head_to_head_battles(period_start, period_end);
