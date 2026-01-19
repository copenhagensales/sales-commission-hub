-- Tilføj manglende menu permissions for fm_leder
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, visibility, parent_key, description)
VALUES 
  ('fm_leder', 'menu_fm_book_week', 'tab', true, true, 'team', 'menu_fm_booking', 'Book uge'),
  ('fm_leder', 'menu_fm_bookings', 'tab', true, true, 'team', 'menu_fm_booking', 'Bookinger'),
  ('fm_leder', 'menu_fm_locations', 'tab', true, true, 'team', 'menu_fm_booking', 'Lokationer')
ON CONFLICT (role_key, permission_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;

-- Tilføj manglende menu permissions for ejer
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, visibility, parent_key, description)
VALUES 
  ('ejer', 'menu_fm_book_week', 'tab', true, true, 'all', 'menu_fm_booking', 'Book uge'),
  ('ejer', 'menu_fm_bookings', 'tab', true, true, 'all', 'menu_fm_booking', 'Bookinger'),
  ('ejer', 'menu_fm_locations', 'tab', true, true, 'all', 'menu_fm_booking', 'Lokationer')
ON CONFLICT (role_key, permission_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;