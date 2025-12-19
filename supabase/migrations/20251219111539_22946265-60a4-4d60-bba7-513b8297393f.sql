-- 1. Drop the policy that allows team members to see each other's full data
DROP POLICY IF EXISTS "Team members can view each other in employee_master_data" ON public.employee_master_data;

-- 2. Create a secure function for team leaders to get only basic employee info
-- This prevents team leaders from seeing sensitive data (CPR, bank, salary, etc.)
CREATE OR REPLACE FUNCTION public.get_team_employees_basic_info()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  private_email text,
  work_email text,
  private_phone text,
  job_title text,
  department text,
  is_active boolean,
  team_id uuid,
  employment_start_date date,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.id,
    e.first_name,
    e.last_name,
    e.private_email,
    e.work_email,
    e.private_phone,
    e.job_title,
    e.department,
    e.is_active,
    e.team_id,
    e.employment_start_date,
    e.created_at
  FROM employee_master_data e
  WHERE is_teamleder_or_above(auth.uid()) 
    AND can_view_employee(e.id, auth.uid())
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_team_employees_basic_info() TO authenticated;

-- Add comment explaining the function purpose
COMMENT ON FUNCTION public.get_team_employees_basic_info() IS 
'Returns basic employee info for team leaders. Excludes sensitive data like CPR, bank details, salary, address, etc.';