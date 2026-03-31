
INSERT INTO public.role_page_permissions (role_key, permission_key, can_view, can_edit, visibility, parent_key)
VALUES
  ('ejer', 'tab_fm_checklist', true, true, 'all', 'menu_fm_booking'),
  ('fm_leder', 'tab_fm_checklist', true, true, 'all', 'menu_fm_booking'),
  ('assisterende_teamleder_fm', 'tab_fm_checklist', true, true, 'team', 'menu_fm_booking'),
  ('assisterendetm', 'tab_fm_checklist', true, true, 'self', 'menu_fm_booking')
ON CONFLICT (role_key, permission_key) DO UPDATE
  SET can_view = EXCLUDED.can_view, can_edit = EXCLUDED.can_edit, visibility = EXCLUDED.visibility, parent_key = EXCLUDED.parent_key;
