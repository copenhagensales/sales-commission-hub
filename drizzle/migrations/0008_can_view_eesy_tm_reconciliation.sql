CREATE OR REPLACE FUNCTION public.can_view_eesy_tm_reconciliation()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.effective_is_superadmin()
    OR public.effective_is_owner()
    OR EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.team_clients tc ON tc.team_id = t.id
      WHERE tc.client_id = '81993a7b-ff24-46b8-8ffb-37a83138ddba'::uuid -- Eesy TM
        AND (
          t.team_leader_id = public.effective_employee_id()
          OR t.assistant_team_leader_id = public.effective_employee_id()
          OR EXISTS (SELECT 1 FROM public.team_assistant_leaders al
                     WHERE al.team_id = t.id AND al.employee_id = public.effective_employee_id())
        )
    )
$function$;
REVOKE ALL ON FUNCTION public.can_view_eesy_tm_reconciliation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_eesy_tm_reconciliation() TO authenticated;