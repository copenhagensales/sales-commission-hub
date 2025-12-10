-- Update is_vagt_admin_or_planner to check system_roles instead of old employee table
CREATE OR REPLACE FUNCTION public.is_vagt_admin_or_planner(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role IN ('ejer', 'teamleder')
  )
$function$;