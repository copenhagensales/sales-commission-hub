-- Function to check if two employees share at least one team via team_members
CREATE OR REPLACE FUNCTION public.shares_team_with_user(_target_employee_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if target employee shares at least one team with current user's employee
    SELECT 1 
    FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.employee_id = _target_employee_id
      AND tm2.employee_id = get_employee_id_for_user(_user_id)
  )
$$;

-- Also add a simpler version that uses current auth user
CREATE OR REPLACE FUNCTION public.is_in_my_teams(_target_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.employee_id = _target_employee_id
      AND tm2.employee_id = get_current_employee_id()
  )
$$;

COMMENT ON FUNCTION public.shares_team_with_user IS 'Checks if target employee shares at least one team with the user via team_members table';
COMMENT ON FUNCTION public.is_in_my_teams IS 'Checks if target employee shares at least one team with current authenticated user via team_members table';