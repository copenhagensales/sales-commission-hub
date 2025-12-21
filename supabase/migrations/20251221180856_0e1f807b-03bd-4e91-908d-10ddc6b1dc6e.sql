-- Create table for team standard shifts
CREATE TABLE public.team_standard_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_standard_shifts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view team_standard_shifts"
ON public.team_standard_shifts
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage team_standard_shifts"
ON public.team_standard_shifts
FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_team_standard_shifts_updated_at
BEFORE UPDATE ON public.team_standard_shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();