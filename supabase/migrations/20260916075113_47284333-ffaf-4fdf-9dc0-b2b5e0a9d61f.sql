ALTER TABLE public.employee_perks
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS discount_value text;