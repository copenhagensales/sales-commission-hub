-- Recreate get_user_manager_scope as a simple wrapper that returns 'all' for owners, 'team' for teamleaders
-- This fixes the immediate error while we can properly refactor can_view_employee

CREATE OR REPLACE FUNCTION public.get_user_manager_scope(_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_visibility text;
BEGIN
  -- Owner can see all
  IF public.is_owner(_user_id) THEN
    RETURN 'all';
  END IF;
  
  -- Get visibility from role_page_permissions for employees section
  SELECT rpp.visibility INTO v_visibility
  FROM role_page_permissions rpp
  JOIN positions pos ON pos.system_role = rpp.role_key
  JOIN employee_master_data emp ON emp.position_id = pos.id
  WHERE emp.auth_user_id = _user_id
  AND rpp.permission_key = 'employees'
  LIMIT 1;
  
  -- Return visibility or default to 'self'
  RETURN COALESCE(v_visibility, 'self');
END;
$function$;