-- Add target_commission column for "first to goal" duels
ALTER TABLE public.h2h_challenges 
ADD COLUMN target_commission integer DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.h2h_challenges.target_commission IS 'Target commission amount in DKK for "first to goal" type duels. NULL for time-based duels.';