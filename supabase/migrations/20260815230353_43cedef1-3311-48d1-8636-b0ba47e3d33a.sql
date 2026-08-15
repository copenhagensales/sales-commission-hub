INSERT INTO public.role_page_permissions (role_key, permission_key, can_view, can_edit)
VALUES ('assisterendetm', 'menu_reports_tdc_edit_sales', true, true)
ON CONFLICT (role_key, permission_key) DO UPDATE SET can_view = true, can_edit = true;