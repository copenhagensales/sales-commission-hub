-- Faelles kilde til teamattribution: aktive medlemsskaber + sidste kendte team
-- for fratraadte medarbejdere. Bruges af historiske rapporter/leaderboards, saa
-- de ikke mister teamnavn naar team_members ryddes op ved deaktivering.
CREATE OR REPLACE VIEW public.employee_team_attribution
WITH (security_invoker = on) AS
SELECT
  tm.employee_id,
  tm.team_id,
  t.name AS team_name,
  true AS is_current
FROM public.team_members tm
JOIN public.teams t ON t.id = tm.team_id
UNION
SELECT
  e.id AS employee_id,
  e.last_team_id AS team_id,
  t.name AS team_name,
  false AS is_current
FROM public.employee_master_data e
JOIN public.teams t ON t.id = e.last_team_id
WHERE e.is_active = false
  AND e.last_team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm2 WHERE tm2.employee_id = e.id
  );

COMMENT ON VIEW public.employee_team_attribution IS
  'Medarbejder -> team til historisk attribution. is_current=true: aktiv teamtilknytning (team_members). is_current=false: fratraadt medarbejders sidste kendte team (employee_master_data.last_team_id).';

GRANT SELECT ON public.employee_team_attribution TO authenticated;
GRANT SELECT ON public.employee_team_attribution TO service_role;