-- Create table for shift breaks (multiple breaks per shift)
CREATE TABLE public.team_shift_breaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.team_standard_shifts(id) ON DELETE CASCADE,
  break_start TIME NOT NULL,
  break_end TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_shift_breaks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view team_shift_breaks"
ON public.team_shift_breaks
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage team_shift_breaks"
ON public.team_shift_breaks
FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- Remove old break columns from team_standard_shifts
ALTER TABLE public.team_standard_shifts DROP COLUMN IF EXISTS break_start;
ALTER TABLE public.team_standard_shifts DROP COLUMN IF EXISTS break_end;