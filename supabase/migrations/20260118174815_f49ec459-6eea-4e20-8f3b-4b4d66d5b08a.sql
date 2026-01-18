ALTER TABLE public.personnel_salaries
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL;