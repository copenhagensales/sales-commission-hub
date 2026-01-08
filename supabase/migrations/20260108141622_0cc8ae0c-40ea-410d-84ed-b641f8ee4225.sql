-- 1. Opret funktion til at hente brugerens manager_data_scope
CREATE OR REPLACE FUNCTION public.get_user_manager_scope(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jp.manager_data_scope
  FROM employee_master_data emd
  JOIN job_positions jp ON LOWER(emd.job_title) = LOWER(jp.name)
  WHERE emd.auth_user_id = _user_id 
    AND emd.is_active = true
  LIMIT 1
$$;

-- 2. Opret funktion til at tjekke om bruger har manager position
CREATE OR REPLACE FUNCTION public.is_manager_position(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM employee_master_data emd
    JOIN job_positions jp ON LOWER(emd.job_title) = LOWER(jp.name)
    WHERE emd.auth_user_id = _user_id 
      AND emd.is_active = true
      AND jp.is_manager = true
  )
  -- Fallback til eksisterende system_roles for bagudkompatibilitet
  OR EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role IN ('ejer', 'teamleder')
  )
$$;

-- 3. Opdater is_manager_or_above til at bruge den nye is_manager_position
CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_manager_position(_user_id)
$$;

-- 4. Opdater can_view_employee til at bruge manager_data_scope
CREATE OR REPLACE FUNCTION public.can_view_employee(_employee_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Scope 'all': Kan se alle
    COALESCE(public.get_user_manager_scope(_user_id), 'self') = 'all'
    OR
    -- Scope 'team': Kan se medarbejdere i egne teams
    (COALESCE(public.get_user_manager_scope(_user_id), 'self') = 'team' AND (
      EXISTS (
        SELECT 1 FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.employee_id = _employee_id 
        AND t.team_leader_id = public.get_employee_id_for_user(_user_id)
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

-- 5. Opdater eksisterende job_positions med korrekte is_manager og manager_data_scope værdier
UPDATE job_positions 
SET is_manager = true, manager_data_scope = 'all'
WHERE LOWER(name) = 'ejer';

UPDATE job_positions 
SET is_manager = true, manager_data_scope = 'team'
WHERE LOWER(name) IN ('teamleder', 'assisterende teamleder', 'fieldmarketing leder');

UPDATE job_positions 
SET is_manager = false, manager_data_scope = 'self'
WHERE is_manager IS NULL OR (is_manager = false AND manager_data_scope IS NULL);