CREATE OR REPLACE FUNCTION public.quality_can_view_all(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_superadmin(_user_id)
      OR public.is_quality_controller(_user_id)
      OR public.is_owner(_user_id);
$function$;