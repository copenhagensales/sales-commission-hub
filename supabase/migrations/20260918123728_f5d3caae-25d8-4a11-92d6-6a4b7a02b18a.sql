-- Backfill af sales.agent_email for Lederne-salg hvor sælgerkoblingen først
-- er oprettet nu. Kun rækker hvor feltet er NULL berøres, og mailen hentes
-- deterministisk via employee_agent_mapping -> employee_master_data.work_email.
UPDATE public.sales s
SET agent_email = lower(e.work_email)
FROM public.agents a
JOIN public.employee_agent_mapping m ON m.agent_id = a.id
JOIN public.employee_master_data e ON e.id = m.employee_id
WHERE a.source = 'adversus_lederne'
  AND a.external_adversus_id = s.agent_external_id
  AND s.source = 'adversus_lederne'
  AND s.agent_email IS NULL
  AND e.work_email IS NOT NULL;