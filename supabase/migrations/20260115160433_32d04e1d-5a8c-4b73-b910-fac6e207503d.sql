-- Ret Fieldmarketing permission hierarki til korrekt 3-niveau struktur
-- Roller: ejer, teamleder, rekruttering, medarbejder, some

-- Slet eksisterende permissions der skal gen-oprettes med korrekt hierarki
DELETE FROM role_page_permissions 
WHERE permission_key IN (
  'menu_fm_book_week', 
  'menu_fm_bookings', 
  'menu_fm_locations',
  'menu_fm_time_off',
  'menu_fm_sales_registration'
);

-- 1. BOOKING sidebar-menu (tab under sektion)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, parent_key, can_view, can_edit, description)
VALUES 
  ('ejer', 'menu_fm_booking', 'tab', 'menu_section_fieldmarketing', true, true, 'Booking'),
  ('teamleder', 'menu_fm_booking', 'tab', 'menu_section_fieldmarketing', true, true, 'Booking'),
  ('rekruttering', 'menu_fm_booking', 'tab', 'menu_section_fieldmarketing', false, false, 'Booking'),
  ('medarbejder', 'menu_fm_booking', 'tab', 'menu_section_fieldmarketing', false, false, 'Booking'),
  ('some', 'menu_fm_booking', 'tab', 'menu_section_fieldmarketing', false, false, 'Booking')
ON CONFLICT (role_key, permission_key) DO UPDATE SET
  permission_type = EXCLUDED.permission_type,
  parent_key = EXCLUDED.parent_key,
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  description = EXCLUDED.description;

-- 2. BOOKING FANER (actions under menu_fm_booking)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, parent_key, can_view, can_edit, description)
VALUES 
  -- Book uge fane
  ('ejer', 'menu_fm_book_week', 'action', 'menu_fm_booking', true, true, 'Book uge'),
  ('teamleder', 'menu_fm_book_week', 'action', 'menu_fm_booking', true, true, 'Book uge'),
  ('rekruttering', 'menu_fm_book_week', 'action', 'menu_fm_booking', false, false, 'Book uge'),
  ('medarbejder', 'menu_fm_book_week', 'action', 'menu_fm_booking', false, false, 'Book uge'),
  ('some', 'menu_fm_book_week', 'action', 'menu_fm_booking', false, false, 'Book uge'),
  
  -- Kommende bookinger fane
  ('ejer', 'menu_fm_bookings', 'action', 'menu_fm_booking', true, true, 'Kommende bookinger'),
  ('teamleder', 'menu_fm_bookings', 'action', 'menu_fm_booking', true, true, 'Kommende bookinger'),
  ('rekruttering', 'menu_fm_bookings', 'action', 'menu_fm_booking', false, false, 'Kommende bookinger'),
  ('medarbejder', 'menu_fm_bookings', 'action', 'menu_fm_booking', false, false, 'Kommende bookinger'),
  ('some', 'menu_fm_bookings', 'action', 'menu_fm_booking', false, false, 'Kommende bookinger'),
  
  -- Lokationer fane
  ('ejer', 'menu_fm_locations', 'action', 'menu_fm_booking', true, true, 'Lokationer'),
  ('teamleder', 'menu_fm_locations', 'action', 'menu_fm_booking', true, true, 'Lokationer'),
  ('rekruttering', 'menu_fm_locations', 'action', 'menu_fm_booking', false, false, 'Lokationer'),
  ('medarbejder', 'menu_fm_locations', 'action', 'menu_fm_booking', false, false, 'Lokationer'),
  ('some', 'menu_fm_locations', 'action', 'menu_fm_booking', false, false, 'Lokationer'),
  
  -- Vagtplan FM fane
  ('ejer', 'menu_fm_vagtplan_fm', 'action', 'menu_fm_booking', true, true, 'Vagtplan FM'),
  ('teamleder', 'menu_fm_vagtplan_fm', 'action', 'menu_fm_booking', true, true, 'Vagtplan FM'),
  ('rekruttering', 'menu_fm_vagtplan_fm', 'action', 'menu_fm_booking', false, false, 'Vagtplan FM'),
  ('medarbejder', 'menu_fm_vagtplan_fm', 'action', 'menu_fm_booking', false, false, 'Vagtplan FM'),
  ('some', 'menu_fm_vagtplan_fm', 'action', 'menu_fm_booking', false, false, 'Vagtplan FM')
ON CONFLICT (role_key, permission_key) DO UPDATE SET
  permission_type = EXCLUDED.permission_type,
  parent_key = EXCLUDED.parent_key,
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  description = EXCLUDED.description;

-- 3. ANDRE SIDEBAR-MENUER (tabs under sektion)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, parent_key, can_view, can_edit, description)
VALUES 
  -- Dashboard
  ('ejer', 'menu_fm_dashboard', 'tab', 'menu_section_fieldmarketing', true, true, 'Dashboard'),
  ('teamleder', 'menu_fm_dashboard', 'tab', 'menu_section_fieldmarketing', true, false, 'Dashboard'),
  ('rekruttering', 'menu_fm_dashboard', 'tab', 'menu_section_fieldmarketing', false, false, 'Dashboard'),
  ('medarbejder', 'menu_fm_dashboard', 'tab', 'menu_section_fieldmarketing', false, false, 'Dashboard'),
  ('some', 'menu_fm_dashboard', 'tab', 'menu_section_fieldmarketing', false, false, 'Dashboard'),
  
  -- Salgsregistrering
  ('ejer', 'menu_fm_sales_registration', 'tab', 'menu_section_fieldmarketing', true, true, 'Salgsregistrering'),
  ('teamleder', 'menu_fm_sales_registration', 'tab', 'menu_section_fieldmarketing', true, true, 'Salgsregistrering'),
  ('rekruttering', 'menu_fm_sales_registration', 'tab', 'menu_section_fieldmarketing', false, false, 'Salgsregistrering'),
  ('medarbejder', 'menu_fm_sales_registration', 'tab', 'menu_section_fieldmarketing', true, true, 'Salgsregistrering'),
  ('some', 'menu_fm_sales_registration', 'tab', 'menu_section_fieldmarketing', false, false, 'Salgsregistrering'),
  
  -- Rejseudgifter
  ('ejer', 'menu_fm_travel_expenses', 'tab', 'menu_section_fieldmarketing', true, true, 'Rejseudgifter'),
  ('teamleder', 'menu_fm_travel_expenses', 'tab', 'menu_section_fieldmarketing', true, true, 'Rejseudgifter'),
  ('rekruttering', 'menu_fm_travel_expenses', 'tab', 'menu_section_fieldmarketing', false, false, 'Rejseudgifter'),
  ('medarbejder', 'menu_fm_travel_expenses', 'tab', 'menu_section_fieldmarketing', false, false, 'Rejseudgifter'),
  ('some', 'menu_fm_travel_expenses', 'tab', 'menu_section_fieldmarketing', false, false, 'Rejseudgifter'),
  
  -- Ret salg
  ('ejer', 'menu_fm_edit_sales', 'tab', 'menu_section_fieldmarketing', true, true, 'Ret salg'),
  ('teamleder', 'menu_fm_edit_sales', 'tab', 'menu_section_fieldmarketing', true, true, 'Ret salg'),
  ('rekruttering', 'menu_fm_edit_sales', 'tab', 'menu_section_fieldmarketing', false, false, 'Ret salg'),
  ('medarbejder', 'menu_fm_edit_sales', 'tab', 'menu_section_fieldmarketing', false, false, 'Ret salg'),
  ('some', 'menu_fm_edit_sales', 'tab', 'menu_section_fieldmarketing', false, false, 'Ret salg'),
  
  -- Fraværsanmodninger
  ('ejer', 'menu_fm_time_off', 'tab', 'menu_section_fieldmarketing', true, true, 'Fraværsanmodninger'),
  ('teamleder', 'menu_fm_time_off', 'tab', 'menu_section_fieldmarketing', true, true, 'Fraværsanmodninger'),
  ('rekruttering', 'menu_fm_time_off', 'tab', 'menu_section_fieldmarketing', false, false, 'Fraværsanmodninger'),
  ('medarbejder', 'menu_fm_time_off', 'tab', 'menu_section_fieldmarketing', false, false, 'Fraværsanmodninger'),
  ('some', 'menu_fm_time_off', 'tab', 'menu_section_fieldmarketing', false, false, 'Fraværsanmodninger')
ON CONFLICT (role_key, permission_key) DO UPDATE SET
  permission_type = EXCLUDED.permission_type,
  parent_key = EXCLUDED.parent_key,
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  description = EXCLUDED.description;

-- Opdater eksisterende permissions med korrekte beskrivelser
UPDATE role_page_permissions 
SET description = 'Køretøjer'
WHERE permission_key = 'menu_fm_vehicles';

UPDATE role_page_permissions 
SET description = 'Fakturering'
WHERE permission_key = 'menu_fm_billing';