CREATE OR REPLACE FUNCTION public.get_user_manager_scope(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visibility text;
BEGIN
  -- Owner can see all
  IF public.is_owner(_user_id) THEN
    RETURN 'all';
  END IF;
  
  -- Get visibility from role_page_permissions for employees section
  -- FIXED: positions → job_positions, system_role → system_role_key, employees → menu_employees
  SELECT rpp.visibility INTO v_visibility
  FROM role_page_permissions rpp
  JOIN job_positions pos ON pos.system_role_key = rpp.role_key
  JOIN employee_master_data emp ON emp.position_id = pos.id
  WHERE emp.auth_user_id = _user_id
  AND rpp.permission_key = 'menu_employees'
  LIMIT 1;
  
  -- Return visibility or default to 'self'
  RETURN COALESCE(v_visibility, 'self');
END;
$$;