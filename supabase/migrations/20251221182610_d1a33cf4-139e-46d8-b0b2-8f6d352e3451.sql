-- Create table for day-specific shift configurations
CREATE TABLE public.team_standard_shift_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.team_standard_shifts(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 1 = Monday, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shift_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.team_standard_shift_days ENABLE ROW LEVEL SECURITY;

-- Create policies (same as parent table)
CREATE POLICY "Authenticated users can view shift days"
ON public.team_standard_shift_days
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert shift days"
ON public.team_standard_shift_days
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update shift days"
ON public.team_standard_shift_days
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete shift days"
ON public.team_standard_shift_days
FOR DELETE
TO authenticated
USING (true);