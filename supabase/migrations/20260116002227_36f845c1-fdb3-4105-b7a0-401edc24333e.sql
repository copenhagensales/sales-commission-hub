-- Liga Test Board (kun for ejere som standard)
INSERT INTO role_page_permissions 
  (role_key, permission_key, permission_type, can_view, can_edit, visibility, parent_key, description)
SELECT 
  role_key,
  'menu_liga_test_board',
  'action',
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN 'all' ELSE 'self' END,
  'menu_commission_league',
  'Liga Test Board'
FROM (SELECT DISTINCT role_key FROM role_page_permissions) AS roles
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- H2H Admin (ejere og teamledere)
INSERT INTO role_page_permissions 
  (role_key, permission_key, permission_type, can_view, can_edit, visibility, parent_key, description)
SELECT 
  role_key,
  'menu_h2h_admin',
  'action',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN 'all' WHEN role_key = 'teamleder' THEN 'team' ELSE 'self' END,
  'menu_commission_league',
  'H2H Admin'
FROM (SELECT DISTINCT role_key FROM role_page_permissions) AS roles
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Team H2H (teamledere og ejere)
INSERT INTO role_page_permissions 
  (role_key, permission_key, permission_type, can_view, can_edit, visibility, parent_key, description)
SELECT 
  role_key,
  'menu_team_h2h',
  'action',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN 'all' WHEN role_key = 'teamleder' THEN 'team' ELSE 'self' END,
  'menu_commission_league',
  'Team H2H'
FROM (SELECT DISTINCT role_key FROM role_page_permissions) AS roles
ON CONFLICT (role_key, permission_key) DO NOTHING;