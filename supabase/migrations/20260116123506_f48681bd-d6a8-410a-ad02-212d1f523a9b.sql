-- Tilføj softphone permissions for rekruttering, teamleder og ejer roller
INSERT INTO role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
VALUES 
  -- Rekruttering får fuld softphone adgang
  ('rekruttering', 'softphone_outbound', true, false, 'all'),
  ('rekruttering', 'softphone_inbound', true, false, 'all'),
  ('rekruttering', 'employee_sms', true, false, 'all'),
  
  -- Teamleder får softphone til team
  ('teamleder', 'softphone_outbound', true, false, 'team'),
  ('teamleder', 'softphone_inbound', false, false, 'self'),
  ('teamleder', 'employee_sms', true, false, 'team'),
  
  -- Ejer får fuld softphone adgang
  ('ejer', 'softphone_outbound', true, false, 'all'),
  ('ejer', 'softphone_inbound', true, false, 'all'),
  ('ejer', 'employee_sms', true, false, 'all')
ON CONFLICT (role_key, permission_key) DO UPDATE SET 
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  visibility = EXCLUDED.visibility;