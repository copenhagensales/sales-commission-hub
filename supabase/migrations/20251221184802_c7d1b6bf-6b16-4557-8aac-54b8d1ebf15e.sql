-- Add day_of_week column to team_shift_breaks to support day-specific breaks
ALTER TABLE public.team_shift_breaks
ADD COLUMN day_of_week integer DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.team_shift_breaks.day_of_week IS 'Optional: 0=Sunday, 1=Monday, etc. NULL means the break applies to all days';

-- Add constraint to ensure valid day values
ALTER TABLE public.team_shift_breaks
ADD CONSTRAINT team_shift_breaks_day_of_week_check CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6));