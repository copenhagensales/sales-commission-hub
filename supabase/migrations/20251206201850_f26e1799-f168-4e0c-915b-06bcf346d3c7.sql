-- Update is_manager_or_above function to also check for owner role in system_roles
CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'manager', 'payroll')
  )
  OR EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role IN ('ejer', 'teamleder')
  )
$function$;