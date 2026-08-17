INSERT INTO public.role_page_permissions (role_key, permission_key, parent_key, permission_type, can_view, can_edit, visibility)
SELECT r.key, p.permission_key, p.parent_key, 'page', true, true, 'all'
FROM public.system_role_definitions r
CROSS JOIN (VALUES
  ('menu_section_it', NULL::text),
  ('menu_it_workstations', 'menu_section_it')
) AS p(permission_key, parent_key)
ON CONFLICT (role_key, permission_key) DO NOTHING;

UPDATE public.employee_master_data
SET is_staff_employee = true
WHERE id = '6f6ae026-ba0f-4edb-9bea-bc84b7871116'
  AND is_staff_employee IS DISTINCT FROM true;