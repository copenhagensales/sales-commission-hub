-- Opdater active_employees beskrivelse
UPDATE kpi_definitions 
SET description = 'Antal aktive medarbejdere ekskl. stab/backoffice (is_active = true AND is_staff_employee = false).',
    sql_query = 'SELECT COUNT(*) FROM employee_master_data WHERE is_active = true AND is_staff_employee = false'
WHERE slug = 'active_employees';

-- Opret 3 nye KPI-definitioner for personale-siden
INSERT INTO kpi_definitions (slug, name, category, description, calculation_formula, sql_query, data_sources, important_notes, is_active) VALUES
('staff_employees', 'Stab medarbejdere', 'employees', 
 'Antal aktive stab/backoffice medarbejdere.',
 'COUNT(employee_master_data) WHERE is_active = true AND is_staff_employee = true',
 'SELECT COUNT(*) FROM employee_master_data WHERE is_active = true AND is_staff_employee = true',
 ARRAY['employee_master_data'],
 ARRAY['Inkluderer kun stab/backoffice roller'],
 true),

('team_count', 'Antal teams', 'employees',
 'Totalt antal teams i systemet.',
 'COUNT(teams)',
 'SELECT COUNT(*) FROM teams',
 ARRAY['teams'],
 ARRAY['Tæller alle teams uanset status'],
 true),

('position_count', 'Antal stillinger', 'employees',
 'Antal aktive stillinger/job positions.',
 'COUNT(job_positions) WHERE is_active = true',
 'SELECT COUNT(*) FROM job_positions WHERE is_active = true',
 ARRAY['job_positions'],
 ARRAY['Kun aktive stillinger tælles'],
 true);