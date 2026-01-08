-- Add daily_bonus_client_id column to onboarding_cohorts table
ALTER TABLE public.onboarding_cohorts 
ADD COLUMN IF NOT EXISTS daily_bonus_client_id UUID REFERENCES public.clients(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_cohorts_daily_bonus_client 
ON public.onboarding_cohorts(daily_bonus_client_id);