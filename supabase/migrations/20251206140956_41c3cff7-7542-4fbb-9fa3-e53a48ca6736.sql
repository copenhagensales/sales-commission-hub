-- Add new employee compensation fields
ALTER TABLE public.employee_master_data
ADD COLUMN IF NOT EXISTS referral_bonus numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS salary_deduction numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS salary_deduction_note text DEFAULT NULL;

-- Add comment to explain fields
COMMENT ON COLUMN public.employee_master_data.referral_bonus IS 'One-time referral bonus amount';
COMMENT ON COLUMN public.employee_master_data.salary_deduction IS 'Monthly salary deduction amount';
COMMENT ON COLUMN public.employee_master_data.salary_deduction_note IS 'Note explaining the salary deduction';