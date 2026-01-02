
-- Add is_active column to onboarding_days table
ALTER TABLE public.onboarding_days 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing rows to be active
UPDATE public.onboarding_days SET is_active = true WHERE is_active IS NULL;
