-- Opdater is_vagt_admin_or_planner til at inkludere Assisterende Teamleder FM
CREATE OR REPLACE FUNCTION public.is_vagt_admin_or_planner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role IN ('ejer', 'teamleder')
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data emd
    LEFT JOIN public.job_positions jp ON emd.position_id = jp.id
    WHERE emd.auth_user_id = _user_id 
      AND emd.is_active = true
      AND (
        emd.job_title IN ('Fieldmarketing leder', 'Ejer', 'Teamleder', 'Assisterende Teamleder FM', 'Assisterende Teamleder')
        OR jp.system_role_key IN ('ejer', 'teamleder', 'assisterende_teamleder_fm', 'fm_leder')
      )
  )
$$;