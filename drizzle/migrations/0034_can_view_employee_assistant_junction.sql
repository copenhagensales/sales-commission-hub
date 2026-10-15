CREATE OR REPLACE FUNCTION public.can_view_employee(_employee_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_viewer_employee_id uuid;
  v_scope text;
BEGIN
  SELECT id INTO v_viewer_employee_id
  FROM employee_master_data
  WHERE auth_user_id = _user_id
  LIMIT 1;

  IF v_viewer_employee_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _employee_id = v_viewer_employee_id THEN
    RETURN TRUE;
  END IF;

  v_scope := COALESCE(public.get_user_manager_scope(_user_id), 'self');

  IF v_scope = 'all' THEN
    RETURN TRUE;
  END IF;

  IF v_scope = 'team' THEN
    RETURN EXISTS (
      SELECT 1 FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.employee_id = _employee_id
      AND (
        t.team_leader_id = v_viewer_employee_id
        OR t.assistant_team_leader_id = v_viewer_employee_id
        OR EXISTS (
          SELECT 1 FROM team_assistant_leaders tal
          WHERE tal.team_id = t.id AND tal.employee_id = v_viewer_employee_id
        )
      )
    );
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM employee_master_data
    WHERE id = _employee_id AND manager_id = v_viewer_employee_id
  );
END;
$function$;