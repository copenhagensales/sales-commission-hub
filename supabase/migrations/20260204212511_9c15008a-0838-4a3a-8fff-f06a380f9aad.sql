-- Add hourly_rate column to personnel_salaries for assistant team leaders
ALTER TABLE public.personnel_salaries
ADD COLUMN hourly_rate numeric DEFAULT NULL;

-- Add comment explaining usage
COMMENT ON COLUMN public.personnel_salaries.hourly_rate IS 'Timeløn for assisterende teamledere. Bruges til timer-baseret lønberegning.';