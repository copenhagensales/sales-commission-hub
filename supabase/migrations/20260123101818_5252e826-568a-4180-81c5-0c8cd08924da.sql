-- Delete permissions for removed dashboards
DELETE FROM role_page_permissions 
WHERE permission_key IN (
  'menu_dashboard_team',
  'menu_dashboard_tdc_goals', 
  'menu_dashboard_fm_goals',
  'menu_dashboard_tryg',
  'menu_dashboard_ase',
  'menu_tryg_dashboard',
  'menu_ase_dashboard'
);

-- Delete any TV board access entries for removed dashboards
DELETE FROM tv_board_access 
WHERE dashboard_slug IN ('team', 'tdc-erhverv-goals', 'fieldmarketing-goals', 'tryg', 'ase');