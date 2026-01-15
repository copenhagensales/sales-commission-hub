-- Create parent menu permissions for collapsible sections
-- Each parent permission controls visibility of the entire section

-- First, insert parent permissions for each role
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description)
SELECT 
  rpp.role_key,
  parent_menu.key,
  'page',
  CASE 
    WHEN rpp.role_key IN ('ejer', 'teamleder') THEN true 
    ELSE false 
  END,
  false,
  parent_menu.description
FROM (SELECT DISTINCT role_key FROM role_page_permissions) rpp
CROSS JOIN (VALUES 
  ('menu_section_personale', 'Personale sektion'),
  ('menu_section_ledelse', 'Ledelse sektion'),
  ('menu_section_test', 'Test sektion'),
  ('menu_section_mg', 'MG sektion'),
  ('menu_section_vagtplan', 'Vagtplan sektion'),
  ('menu_section_fieldmarketing', 'Fieldmarketing sektion'),
  ('menu_section_rekruttering', 'Rekruttering sektion'),
  ('menu_section_boards', 'Boards sektion'),
  ('menu_section_salary', 'Løn sektion'),
  ('menu_section_personal', 'Personlig sektion')
) AS parent_menu(key, description)
ON CONFLICT DO NOTHING;

-- Update existing permissions to have parent_key references
-- Personnel items -> menu_section_personale
UPDATE role_page_permissions 
SET parent_key = 'menu_section_personale', permission_type = 'tab'
WHERE permission_key IN ('menu_employees', 'menu_teams')
AND parent_key IS NULL;

-- Management items -> menu_section_ledelse  
UPDATE role_page_permissions 
SET parent_key = 'menu_section_ledelse', permission_type = 'tab'
WHERE permission_key IN ('menu_contracts', 'menu_permissions', 'menu_career_wishes_overview')
AND parent_key IS NULL;

-- Shift items -> menu_section_vagtplan
UPDATE role_page_permissions 
SET parent_key = 'menu_section_vagtplan', permission_type = 'tab'
WHERE permission_key IN ('menu_shift_overview', 'menu_absence', 'menu_time_tracking', 'menu_extra_work', 'menu_extra_work_admin')
AND parent_key IS NULL;

-- Recruitment items -> menu_section_rekruttering
UPDATE role_page_permissions 
SET parent_key = 'menu_section_rekruttering', permission_type = 'tab'
WHERE permission_key IN ('menu_recruitment_dashboard', 'menu_candidates', 'menu_upcoming_interviews', 'menu_winback', 'menu_upcoming_hires', 'menu_messages', 'menu_sms_templates', 'menu_email_templates')
AND parent_key IS NULL;

-- Personal items -> menu_section_personal
UPDATE role_page_permissions 
SET parent_key = 'menu_section_personal', permission_type = 'tab'
WHERE permission_key IN ('menu_my_schedule', 'menu_my_profile', 'menu_my_contracts', 'menu_career_wishes', 'menu_time_stamp')
AND parent_key IS NULL;