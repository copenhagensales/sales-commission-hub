-- Add percentage_rate and minimum_salary columns to personnel_salaries
ALTER TABLE public.personnel_salaries
ADD COLUMN IF NOT EXISTS percentage_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_salary NUMERIC DEFAULT 0;