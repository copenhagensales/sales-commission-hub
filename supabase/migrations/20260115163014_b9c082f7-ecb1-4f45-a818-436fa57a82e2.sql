-- Add permission keys for all tabs across all tabbed pages
-- This migration adds action-type permissions for individual tabs

-- ==========================================
-- 1. EmployeeMasterData tabs (6 tabs)
-- ==========================================
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, description)
SELECT r.role_key, p.permission_key, p.parent_key, 'action', p.can_view, p.can_edit, p.description
FROM (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS r(role_key)
CROSS JOIN (VALUES
  ('tab_employees_all', 'menu_employees', true, true, 'Fane: Alle medarbejdere'),
  ('tab_employees_staff', 'menu_employees', true, true, 'Fane: Backoffice'),
  ('tab_employees_teams', 'menu_employees', true, true, 'Fane: Teams'),
  ('tab_employees_positions', 'menu_employees', true, true, 'Fane: Stillinger'),
  ('tab_employees_permissions', 'menu_employees', true, true, 'Fane: Rettigheder'),
  ('tab_employees_dialer', 'menu_employees', true, true, 'Fane: Dialer-mapping')
) AS p(permission_key, parent_key, can_view, can_edit, description)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Update specific roles with restricted access
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key = 'tab_employees_permissions' AND role_key IN ('medarbejder', 'some');
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key = 'tab_employees_dialer' AND role_key IN ('medarbejder', 'some', 'rekruttering');
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key = 'tab_employees_staff' AND role_key IN ('medarbejder', 'some');
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key = 'tab_employees_positions' AND role_key IN ('medarbejder', 'some');

-- ==========================================
-- 2. OnboardingDashboard tabs (6 tabs)
-- ==========================================
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, description)
SELECT r.role_key, p.permission_key, p.parent_key, 'action', p.can_view, p.can_edit, p.description
FROM (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS r(role_key)
CROSS JOIN (VALUES
  ('tab_onboarding_overview', 'menu_onboarding_overview', true, true, 'Fane: Oversigt'),
  ('tab_onboarding_ramp', 'menu_onboarding_overview', true, true, 'Fane: Forventninger'),
  ('tab_onboarding_leader', 'menu_onboarding_overview', true, true, 'Fane: Leder'),
  ('tab_onboarding_drills', 'menu_onboarding_overview', true, true, 'Fane: Drill-bibliotek'),
  ('tab_onboarding_template', 'menu_onboarding_overview', true, true, 'Fane: Skabelon'),
  ('tab_onboarding_admin', 'menu_onboarding_overview', true, true, 'Fane: Admin')
) AS p(permission_key, parent_key, can_view, can_edit, description)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Restrict onboarding admin tabs
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key = 'tab_onboarding_admin' AND role_key IN ('medarbejder', 'some', 'rekruttering');
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key = 'tab_onboarding_leader' AND role_key IN ('medarbejder', 'some');
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key = 'tab_onboarding_template' AND role_key IN ('medarbejder', 'some');

-- ==========================================
-- 3. MgTestPage tabs (3 tabs)
-- ==========================================
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, description)
SELECT r.role_key, p.permission_key, p.parent_key, 'action', p.can_view, p.can_edit, p.description
FROM (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS r(role_key)
CROSS JOIN (VALUES
  ('tab_mg_salary_schemes', 'menu_mg_test', true, true, 'Fane: Lønordninger'),
  ('tab_mg_relatel_status', 'menu_mg_test', true, true, 'Fane: Relatel Status'),
  ('tab_mg_relatel_events', 'menu_mg_test', true, true, 'Fane: Relatel Events')
) AS p(permission_key, parent_key, can_view, can_edit, description)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Restrict MG test tabs
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key LIKE 'tab_mg_%' AND role_key IN ('medarbejder', 'some', 'rekruttering');

-- ==========================================
-- 4. Winback tabs (3 tabs)
-- ==========================================
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, description)
SELECT r.role_key, p.permission_key, p.parent_key, 'action', p.can_view, p.can_edit, p.description
FROM (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS r(role_key)
CROSS JOIN (VALUES
  ('tab_winback_ghostet', 'menu_winback', true, true, 'Fane: Ghostet'),
  ('tab_winback_takket_nej', 'menu_winback', true, true, 'Fane: Takket nej'),
  ('tab_winback_kundeservice', 'menu_winback', true, true, 'Fane: Kundeservice')
) AS p(permission_key, parent_key, can_view, can_edit, description)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Restrict winback tabs to rekruttering and above
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key LIKE 'tab_winback_%' AND role_key IN ('medarbejder', 'some');

-- ==========================================
-- 5. Messages tabs (5 tabs)
-- ==========================================
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, description)
SELECT r.role_key, p.permission_key, p.parent_key, 'action', p.can_view, p.can_edit, p.description
FROM (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS r(role_key)
CROSS JOIN (VALUES
  ('tab_messages_all', 'menu_messages_recruitment', true, true, 'Fane: Alle beskeder'),
  ('tab_messages_sms', 'menu_messages_recruitment', true, true, 'Fane: SMS'),
  ('tab_messages_email', 'menu_messages_recruitment', true, true, 'Fane: Email'),
  ('tab_messages_call', 'menu_messages_recruitment', true, true, 'Fane: Opkald'),
  ('tab_messages_sent', 'menu_messages_recruitment', true, true, 'Fane: Sendt')
) AS p(permission_key, parent_key, can_view, can_edit, description)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Restrict messages tabs
UPDATE role_page_permissions SET can_view = false, can_edit = false WHERE permission_key LIKE 'tab_messages_%' AND role_key IN ('medarbejder', 'some');

-- ==========================================
-- 6. FieldmarketingDashboardFull tabs (2 tabs)
-- ==========================================
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, description)
SELECT r.role_key, p.permission_key, p.parent_key, 'action', p.can_view, p.can_edit, p.description
FROM (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS r(role_key)
CROSS JOIN (VALUES
  ('tab_fm_eesy', 'menu_dashboard_fieldmarketing', true, true, 'Fane: Eesy FM'),
  ('tab_fm_yousee', 'menu_dashboard_fieldmarketing', true, true, 'Fane: Yousee')
) AS p(permission_key, parent_key, can_view, can_edit, description)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- ==========================================
-- 7. BookingManagement tabs (ensure they are present)
-- ==========================================
INSERT INTO role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, description)
SELECT r.role_key, p.permission_key, p.parent_key, 'action', p.can_view, p.can_edit, p.description
FROM (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS r(role_key)
CROSS JOIN (VALUES
  ('tab_fm_book_week', 'menu_fm_booking', true, true, 'Fane: Book uge'),
  ('tab_fm_bookings', 'menu_fm_booking', true, true, 'Fane: Kommende bookinger'),
  ('tab_fm_locations', 'menu_fm_booking', true, true, 'Fane: Lokationer'),
  ('tab_fm_vagtplan', 'menu_fm_booking', true, true, 'Fane: Vagtplan FM')
) AS p(permission_key, parent_key, can_view, can_edit, description)
ON CONFLICT (role_key, permission_key) DO NOTHING;