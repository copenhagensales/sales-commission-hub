INSERT INTO public.team_dashboard_permissions (team_id, dashboard_slug, access_level)
SELECT team_id, 'ase-fm', access_level
FROM public.team_dashboard_permissions
WHERE dashboard_slug = 'fieldmarketing'
  AND NOT EXISTS (
    SELECT 1 FROM public.team_dashboard_permissions t2
    WHERE t2.dashboard_slug = 'ase-fm' AND t2.team_id = public.team_dashboard_permissions.team_id
  );

INSERT INTO public.role_page_permissions (role_key, permission_key, parent_key, permission_type, description, can_view, can_edit, visibility)
SELECT role_key, 'menu_dashboard_ase_fm', parent_key, permission_type, 'ASE FM', can_view, can_edit, visibility
FROM public.role_page_permissions
WHERE permission_key = 'menu_dashboard_fieldmarketing'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_page_permissions r2
    WHERE r2.permission_key = 'menu_dashboard_ase_fm' AND r2.role_key = public.role_page_permissions.role_key
  );