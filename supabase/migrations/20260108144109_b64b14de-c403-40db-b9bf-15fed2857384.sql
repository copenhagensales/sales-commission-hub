
-- Update can_view_employee to also check assistant_team_leader_id
CREATE OR REPLACE FUNCTION public.can_view_employee(_employee_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Scope 'all': Kan se alle (alt scope = scope_employees 'alt')
    COALESCE(public.get_user_manager_scope(_user_id), 'self') = 'all'
    OR
    -- Scope 'team': Kan se medarbejdere i egne teams (leder ELLER assistant)
    (COALESCE(public.get_user_manager_scope(_user_id), 'self') = 'team' AND (
      EXISTS (
        SELECT 1 FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.employee_id = _employee_id 
        AND (
          t.team_leader_id = public.get_employee_id_for_user(_user_id)
          OR t.assistant_team_leader_id = public.get_employee_id_for_user(_user_id)
        )
      )
      OR _employee_id = public.get_employee_id_for_user(_user_id)
    ))
    OR
    -- Scope 'self': Kun sig selv
    _employee_id = public.get_employee_id_for_user(_user_id)
    OR
    -- Fallback: manager_id relation
    EXISTS (
      SELECT 1 FROM employee_master_data
      WHERE id = _employee_id 
      AND manager_id = public.get_employee_id_for_user(_user_id)
    )
$$;
