
-- Tilføj softphone permissions til roller der mangler dem (uden at overskrive eksisterende)
INSERT INTO role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
SELECT r.role_key, p.permission_key, false, false, 'self'
FROM (
  SELECT DISTINCT role_key FROM role_page_permissions
) r
CROSS JOIN (
  SELECT 'softphone_outbound' as permission_key
  UNION ALL SELECT 'softphone_inbound'
  UNION ALL SELECT 'employee_sms'
) p
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = r.role_key AND rpp.permission_key = p.permission_key
)
ON CONFLICT (role_key, permission_key) DO NOTHING;
