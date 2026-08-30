-- ============================================================================
-- A3: Oprydning af teamtilknytninger for inaktive medarbejdere
-- last_team_id bevares af sync_last_team_id() ved DELETE.
-- employee_client_assignments bevares (fn_remove_assignments_on_team_member_delete
-- springer inaktive over).
-- ============================================================================

-- 1) Log teammedlemsskaber der fjernes
INSERT INTO public.team_membership_removal_log
  (employee_id, employee_name, team_id, team_name, removal_type, reason)
SELECT e.id, e.first_name || ' ' || e.last_name, tm.team_id, t.name,
       'team_member', 'cleanup_inactive_backfill'
FROM public.team_members tm
JOIN public.employee_master_data e ON e.id = tm.employee_id
JOIN public.teams t ON t.id = tm.team_id
WHERE e.is_active = false;

-- 2) Log assisterende teamledere der fjernes
INSERT INTO public.team_membership_removal_log
  (employee_id, employee_name, team_id, team_name, removal_type, reason)
SELECT e.id, e.first_name || ' ' || e.last_name, tal.team_id, t.name,
       'assistant_leader', 'cleanup_inactive_backfill'
FROM public.team_assistant_leaders tal
JOIN public.employee_master_data e ON e.id = tal.employee_id
JOIN public.teams t ON t.id = tal.team_id
WHERE e.is_active = false;

-- 3) Log teamledere der fjernes (forventet 0)
INSERT INTO public.team_membership_removal_log
  (employee_id, employee_name, team_id, team_name, removal_type, reason)
SELECT e.id, e.first_name || ' ' || e.last_name, t.id, t.name,
       'team_leader', 'cleanup_inactive_backfill'
FROM public.teams t
JOIN public.employee_master_data e ON e.id = t.team_leader_id
WHERE e.is_active = false;

-- 4) Saet last_team_id foer sletning, hvis den mangler
UPDATE public.employee_master_data e
SET last_team_id = tm.team_id
FROM public.team_members tm
WHERE tm.employee_id = e.id
  AND e.is_active = false
  AND e.last_team_id IS NULL;

-- 5) Fjern tilknytningerne
DELETE FROM public.team_members tm
USING public.employee_master_data e
WHERE e.id = tm.employee_id AND e.is_active = false;

DELETE FROM public.team_assistant_leaders tal
USING public.employee_master_data e
WHERE e.id = tal.employee_id AND e.is_active = false;

UPDATE public.teams t
SET team_leader_id = NULL
WHERE t.team_leader_id IN (
  SELECT id FROM public.employee_master_data WHERE is_active = false
);