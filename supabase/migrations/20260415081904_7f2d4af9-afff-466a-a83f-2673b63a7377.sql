ALTER TABLE public.employee_time_clocks
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS cpo_per_hour numeric DEFAULT 0;