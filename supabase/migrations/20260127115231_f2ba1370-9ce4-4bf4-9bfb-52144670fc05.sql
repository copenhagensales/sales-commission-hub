CREATE OR REPLACE FUNCTION public.is_teamleder_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role IN ('teamleder', 'ejer')
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
      AND is_active = true
      AND LOWER(job_title) IN (
        'ejer', 
        'teamleder', 
        'assisterende teamleder', 
        'fieldmarketing leder',
        'rekruttering'
      )
  )
$$;