-- Tilføj liga admin undermenu for alle roller
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, visibility, parent_key, description)
SELECT 
  role_key,
  'menu_league_admin',
  'action',
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN 'all' ELSE 'self' END,
  'menu_commission_league',
  'Liga Administration'
FROM (SELECT DISTINCT role_key FROM role_page_permissions) AS roles
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Opdater description på hovedmenuen
UPDATE role_page_permissions 
SET description = 'Cph Sales Ligaen' 
WHERE permission_key = 'menu_commission_league';