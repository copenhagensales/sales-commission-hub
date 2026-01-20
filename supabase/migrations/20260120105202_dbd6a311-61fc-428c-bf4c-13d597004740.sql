-- Trin 1: Fix Oscar's position_id til den korrekte Rekruttering position
UPDATE public.employee_master_data 
SET position_id = 'c5df66a2-e126-47e9-8780-557537546c81'
WHERE id = '68dd376f-fb28-4590-9819-7c89c9734080';

-- Trin 2: Opret ny permission-baseret RLS funktion
CREATE OR REPLACE FUNCTION public.has_edit_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      -- Ejere har altid fuld adgang
      WHEN public.is_owner(_user_id) THEN true
      ELSE EXISTS (
        SELECT 1 
        FROM public.role_page_permissions rpp
        JOIN public.job_positions jp ON jp.system_role_key = rpp.role_key
        JOIN public.employee_master_data e ON e.position_id = jp.id
        WHERE e.auth_user_id = _user_id
          AND e.is_active = true
          AND rpp.permission_key = _permission_key
          AND rpp.can_edit = true
      )
    END
$$;

-- Trin 3: Fjern gammel policy og opret ny baseret på permission systemet
DROP POLICY IF EXISTS "Teamledere can manage their team members" ON public.team_members;

CREATE POLICY "Users with edit permission can manage team members" 
ON public.team_members
FOR ALL
TO authenticated
USING (public.has_edit_permission(auth.uid(), 'tab_employees_teams'))
WITH CHECK (public.has_edit_permission(auth.uid(), 'tab_employees_teams'));