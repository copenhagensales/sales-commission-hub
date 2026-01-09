-- Add custom date range columns to h2h_challenges for flexible duel periods
ALTER TABLE public.h2h_challenges 
ADD COLUMN custom_start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN custom_end_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the columns
COMMENT ON COLUMN public.h2h_challenges.custom_start_at IS 'Custom start time for the duel (when using custom period)';
COMMENT ON COLUMN public.h2h_challenges.custom_end_at IS 'Custom end time for the duel (when using custom period)';