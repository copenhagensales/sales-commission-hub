-- Fase 1: Optimer get_employee_id_for_user - fjern langsom email fallback
CREATE OR REPLACE FUNCTION public.get_employee_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.employee_master_data 
  WHERE auth_user_id = _user_id 
  LIMIT 1
$$;

-- Fase 2: Optimer can_view_employee - reducer fra 4 til 1 lookup
CREATE OR REPLACE FUNCTION public.can_view_employee(_employee_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_viewer_employee_id uuid;
  v_scope text;
BEGIN
  -- Cache employee_id lookup (1 gang i stedet for 4)
  SELECT id INTO v_viewer_employee_id 
  FROM employee_master_data 
  WHERE auth_user_id = _user_id 
  LIMIT 1;
  
  IF v_viewer_employee_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check own record first (hurtigst)
  IF _employee_id = v_viewer_employee_id THEN
    RETURN TRUE;
  END IF;
  
  -- Get scope
  v_scope := COALESCE(public.get_user_manager_scope(_user_id), 'self');
  
  IF v_scope = 'all' THEN
    RETURN TRUE;
  END IF;
  
  IF v_scope = 'team' THEN
    RETURN EXISTS (
      SELECT 1 FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.employee_id = _employee_id 
      AND (t.team_leader_id = v_viewer_employee_id OR t.assistant_team_leader_id = v_viewer_employee_id)
    );
  END IF;
  
  -- Fallback: manager_id
  RETURN EXISTS (
    SELECT 1 FROM employee_master_data
    WHERE id = _employee_id AND manager_id = v_viewer_employee_id
  );
END;
$$;

-- Fase 3: Optimer is_teamleder_or_above - brug LOWER index
CREATE OR REPLACE FUNCTION public.is_teamleder_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role IN ('teamleder', 'ejer')
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
      AND is_active = true
      AND LOWER(job_title) IN ('ejer', 'teamleder', 'assisterende teamleder', 'fieldmarketing leder')
  )
$$;

-- Fase 4: Tilføj index på system_roles for hurtigere rolle-checks
CREATE INDEX IF NOT EXISTS idx_system_roles_user_role 
ON system_roles (user_id, role);