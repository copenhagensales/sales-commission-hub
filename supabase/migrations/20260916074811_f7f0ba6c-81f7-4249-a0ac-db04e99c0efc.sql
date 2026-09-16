CREATE OR REPLACE FUNCTION public.can_manage_employee_perks(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(public.is_owner(_user_id), false)
    OR EXISTS (
      SELECT 1
      FROM public.superadmins s
      JOIN auth.users u ON lower(u.email) = lower(s.email)
      WHERE u.id = _user_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.employee_master_data e
      JOIN public.team_members tm ON tm.employee_id = e.id
      JOIN public.teams t ON t.id = tm.team_id
      WHERE e.auth_user_id = _user_id
        AND e.is_active = true
        AND lower(t.name) = 'stab'
    )
    OR COALESCE(public.has_page_permission(_user_id, 'menu_employee_perks', true), false);
$function$;