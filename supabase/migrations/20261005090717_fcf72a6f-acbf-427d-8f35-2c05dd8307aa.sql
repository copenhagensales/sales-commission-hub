UPDATE public.role_page_permissions SET can_view = true, can_edit = true, updated_at = now()
WHERE role_key = 'rekruttering' AND permission_key = 'action_manage_company_events';
INSERT INTO public.role_page_permissions (role_key, permission_key, can_view, can_edit, parent_key, permission_type, visibility)
SELECT 'rekruttering', 'action_manage_company_events', true, true, 'menu_home', 'action', 'self'
WHERE NOT EXISTS (SELECT 1 FROM public.role_page_permissions WHERE role_key = 'rekruttering' AND permission_key = 'action_manage_company_events');