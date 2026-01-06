-- Create a secure view with only non-sensitive employee columns for general authenticated access
CREATE VIEW public.employee_basic_info AS
SELECT 
  id, 
  first_name, 
  last_name, 
  job_title,
  department,
  team_id,
  avatar_url,
  is_active,
  employment_start_date,
  work_email
FROM public.employee_master_data
WHERE is_active = true;

-- Grant access to authenticated users
GRANT SELECT ON public.employee_basic_info TO authenticated;

-- Drop the problematic RLS policy that exposes all columns
DROP POLICY IF EXISTS "Authenticated users can view active employees for h2h" ON public.employee_master_data;