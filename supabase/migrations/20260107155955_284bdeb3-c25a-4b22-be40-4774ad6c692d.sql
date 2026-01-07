
-- Update can_view_employee function to use team_members instead of manager_id
CREATE OR REPLACE FUNCTION public.can_view_employee(_employee_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    -- Owners can see everyone
    public.is_owner(_user_id)
    OR
    -- Teamledere can see employees in teams they lead
    EXISTS (
      SELECT 1 
      FROM public.team_members tm
      JOIN public.teams t ON tm.team_id = t.id
      WHERE tm.employee_id = _employee_id 
      AND t.team_leader_id = public.get_employee_id_for_user(_user_id)
    )
    OR
    -- Users can see themselves
    _employee_id = public.get_employee_id_for_user(_user_id)
    OR
    -- Fallback: can see employees where they are the manager_id
    EXISTS (
      SELECT 1 FROM public.employee_master_data
      WHERE id = _employee_id 
      AND manager_id = public.get_employee_id_for_user(_user_id)
    )
$function$;
