-- Fase 1: Seed menu_dashboards for alle roller (adgang til dashboard-miljøet)
INSERT INTO role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
VALUES 
  ('ejer', 'menu_dashboards', true, true, 'all'),
  ('teamleder', 'menu_dashboards', true, false, 'team'),
  ('rekruttering', 'menu_dashboards', true, false, 'team'),
  ('fm_leder', 'menu_dashboards', true, false, 'team'),
  ('assisterende_teamleder_fm', 'menu_dashboards', true, false, 'team'),
  ('assisterendetm', 'menu_dashboards', true, false, 'team'),
  ('medarbejder', 'menu_dashboards', true, false, 'self'),
  ('fm_medarbejder_', 'menu_dashboards', true, false, 'self'),
  ('some', 'menu_dashboards', true, false, 'self'),
  ('backoffice', 'menu_dashboards', false, false, 'self')
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Seed menu_dashboard_admin (kun ejere har adgang som standard)
INSERT INTO role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
VALUES 
  ('ejer', 'menu_dashboard_admin', true, true, 'all'),
  ('teamleder', 'menu_dashboard_admin', false, false, 'team'),
  ('rekruttering', 'menu_dashboard_admin', false, false, 'team'),
  ('fm_leder', 'menu_dashboard_admin', false, false, 'team'),
  ('assisterende_teamleder_fm', 'menu_dashboard_admin', false, false, 'team'),
  ('assisterendetm', 'menu_dashboard_admin', false, false, 'team'),
  ('medarbejder', 'menu_dashboard_admin', false, false, 'self'),
  ('fm_medarbejder_', 'menu_dashboard_admin', false, false, 'self'),
  ('some', 'menu_dashboard_admin', false, false, 'self'),
  ('backoffice', 'menu_dashboard_admin', false, false, 'self')
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Fase 2: Ryd op i legacy dashboard keys der ikke længere bruges
DELETE FROM role_page_permissions 
WHERE permission_key IN (
  'menu_dashboard',
  'menu_fm_dashboard',
  'menu_mg_test_dashboard',
  'menu_relatel_dashboard',
  'menu_tdc_erhverv_dashboard',
  'menu_recruitment_dashboard',
  'menu_security_dashboard',
  'menu_ase_dashboard',
  'menu_test_dashboard',
  'menu_tryg_dashboard',
  'menu_dashboard_cph_sales',
  'menu_dashboard_fieldmarketing',
  'menu_dashboard_eesy_tm',
  'menu_dashboard_united',
  'menu_dashboard_cs_top_20',
  'menu_dashboard_settings'
);