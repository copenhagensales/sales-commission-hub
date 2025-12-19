
-- Drop old function and create improved version that checks both system_roles AND job_title
CREATE OR REPLACE FUNCTION public.is_vagt_admin_or_planner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role IN ('ejer', 'teamleder')
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
      AND is_active = true
      AND job_title IN ('Fieldmarketing leder', 'Ejer', 'Teamleder')
  )
$$;
