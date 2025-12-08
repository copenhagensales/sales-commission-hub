
-- Drop the old function first
DROP FUNCTION IF EXISTS public.get_employee_roles_for_admin();

-- Recreate with new return type supporting multiple roles
CREATE OR REPLACE FUNCTION public.get_employee_roles_for_admin()
 RETURNS TABLE(employee_id uuid, first_name text, last_name text, email text, job_title text, is_active boolean, auth_user_id uuid, roles system_role[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only owners can call this function
  IF NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Only owners can view employee roles';
  END IF;

  RETURN QUERY
  SELECT 
    emd.id as employee_id,
    emd.first_name,
    emd.last_name,
    emd.private_email as email,
    emd.job_title,
    emd.is_active,
    au.id as auth_user_id,
    COALESCE(array_agg(sr.role) FILTER (WHERE sr.role IS NOT NULL), ARRAY[]::system_role[]) as roles
  FROM public.employee_master_data emd
  LEFT JOIN auth.users au ON au.email = emd.private_email
  LEFT JOIN public.system_roles sr ON sr.user_id = au.id
  WHERE emd.is_active = true
  GROUP BY emd.id, emd.first_name, emd.last_name, emd.private_email, emd.job_title, emd.is_active, au.id
  ORDER BY emd.first_name, emd.last_name;
END;
$function$;
