ALTER TABLE public.cancellation_imports
  ADD COLUMN IF NOT EXISTS default_deduction_date date;

COMMENT ON COLUMN public.cancellation_imports.default_deduction_date IS
  'Default deduction date applied to all cancellation_queue rows from this upload. End date of the chosen payroll period (typically the 14th).';