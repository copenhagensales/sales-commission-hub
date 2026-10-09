ALTER TABLE public.ramp_settings ADD COLUMN IF NOT EXISTS extra_viewer_employee_ids uuid[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.ramp_settings.extra_viewer_employee_ids IS 'Medarbejdere der eksplicit ser hele Opstart-siden (alle teams), uden at lede et ramp-team.';

CREATE OR REPLACE FUNCTION public.is_ramp_extra_viewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.effective_employee_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ramp_settings rs
    WHERE public.effective_employee_id() = ANY(rs.extra_viewer_employee_ids))
$$;
REVOKE ALL ON FUNCTION public.is_ramp_extra_viewer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_ramp_extra_viewer() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_view_ramp_team()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT
    public.effective_is_superadmin()
    OR public.effective_is_owner()
    OR public.effective_has_app_role('admin')
    OR public.is_ramp_extra_viewer()
    OR EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.team_clients tc ON tc.team_id = t.id
      JOIN public.client_campaigns cc ON cc.client_id = tc.client_id
      WHERE cc.ramp_enabled = true
        AND (
          t.team_leader_id = public.effective_employee_id()
          OR t.assistant_team_leader_id = public.effective_employee_id()
          OR EXISTS (SELECT 1 FROM public.team_assistant_leaders al
                     WHERE al.team_id = t.id AND al.employee_id = public.effective_employee_id())
        )
    )
$function$;

DO $$
DECLARE r record; d text; nd text;
BEGIN
  FOR r IN SELECT oid, proname FROM pg_proc WHERE pronamespace='public'::regnamespace
           AND proname IN ('get_ramp_full_team','get_ramp_risk_flags','get_ramp_team_overview') LOOP
    d := pg_get_functiondef(r.oid);
    nd := regexp_replace(d, '(v_all boolean := [^;]*);', '\1 OR public.is_ramp_extra_viewer();');
    IF nd = d THEN RAISE EXCEPTION 'v_all ikke fundet i %', r.proname; END IF;
    EXECUTE nd;
  END LOOP;
END $$;

UPDATE public.ramp_settings
SET extra_viewer_employee_ids = array_append(extra_viewer_employee_ids, '0a3feb45-65bf-4914-a1e4-499c8c727b36'::uuid)
WHERE NOT ('0a3feb45-65bf-4914-a1e4-499c8c727b36'::uuid = ANY(extra_viewer_employee_ids));