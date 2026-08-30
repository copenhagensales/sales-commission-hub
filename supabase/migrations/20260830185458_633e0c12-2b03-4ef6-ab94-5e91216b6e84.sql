-- ============================================================================
-- Backfill: koer sync_personnel_salary_from_master for alle med lonkategori
-- ============================================================================
UPDATE public.employee_master_data
SET salary_notes = salary_notes
WHERE personnel_category IS NOT NULL;

-- Sikr at de seks assistenter staar som fast maanedslon paa stamkortet
UPDATE public.employee_master_data
SET salary_type = 'fixed',
    personnel_category = 'assistant',
    salary_hours_source = COALESCE(salary_hours_source, 'shift'),
    salary_amount = v.amount
FROM (VALUES
  ('Jeppe', 'Buster Munk', 42000::numeric),
  ('Johannes', 'Hedebrink', 40000::numeric),
  ('Sebastian Viktor', 'Bangsbo Petersen', 28000::numeric),
  ('Sejer Sylvester', 'Schmidt', 28000::numeric),
  ('Felix Jens Asbjørn', 'Kjeldsen Jensen', 36000::numeric),
  ('Annika', 'Søndergaard', 28000::numeric)
) AS v(fn, ln, amount)
WHERE employee_master_data.first_name = v.fn
  AND employee_master_data.last_name = v.ln
  AND employee_master_data.is_active = true;

-- Sejer mangler som assisterende teamleder paa Eesy TM
INSERT INTO public.team_assistant_leaders (team_id, employee_id)
SELECT t.id, e.id
FROM public.teams t
JOIN public.employee_master_data e
  ON e.first_name = 'Sejer Sylvester' AND e.last_name = 'Schmidt' AND e.is_active = true
WHERE t.name = 'Eesy TM'
ON CONFLICT DO NOTHING;