-- Insert permission key for the new Markets tab
-- This will be seeded per role via the permission editor

-- No table changes needed - just documenting the new permission key: tab_fm_markets
-- The permission editor will auto-seed this when roles are updated

-- Optionally, pre-seed for fm_leder role (admin-like for fieldmarketing)
INSERT INTO public.role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, visibility, description)
VALUES 
  ('ejer', 'tab_fm_markets', 'menu_fm_booking', 'tab', true, true, 'all', 'Fane: Kommende markeder'),
  ('fm_leder', 'tab_fm_markets', 'menu_fm_booking', 'tab', true, true, 'all', 'Fane: Kommende markeder')
ON CONFLICT (role_key, permission_key) DO NOTHING;