-- Add default_landing_page to job_positions (position-level default)
ALTER TABLE public.job_positions 
ADD COLUMN IF NOT EXISTS default_landing_page text DEFAULT '/home';

-- Add default_landing_page to employee_master_data (individual override)
ALTER TABLE public.employee_master_data 
ADD COLUMN IF NOT EXISTS default_landing_page text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.job_positions.default_landing_page IS 'Default landing page for employees with this position';
COMMENT ON COLUMN public.employee_master_data.default_landing_page IS 'Individual override for default landing page (null = use position default)';