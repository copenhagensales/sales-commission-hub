-- Add daily_rate column to location table with default based on type
ALTER TABLE public.location ADD COLUMN daily_rate numeric DEFAULT 1000;

-- Update existing locations based on type
UPDATE public.location SET daily_rate = 1500 WHERE type = 'Storcenter';
UPDATE public.location SET daily_rate = 1000 WHERE type = 'Butik' OR type IS NULL OR type NOT IN ('Storcenter');