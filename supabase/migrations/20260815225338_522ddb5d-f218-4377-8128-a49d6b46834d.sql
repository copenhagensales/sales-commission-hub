INSERT INTO public.role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
VALUES
  ('ejer', 'menu_reports_tdc_edit_sales', true, true, 'all'),
  ('teamleder', 'menu_reports_tdc_edit_sales', true, true, 'all')
ON CONFLICT (role_key, permission_key) DO UPDATE
  SET can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit,
      visibility = EXCLUDED.visibility;