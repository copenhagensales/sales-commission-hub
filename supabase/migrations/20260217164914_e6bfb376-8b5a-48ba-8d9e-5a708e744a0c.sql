
CREATE OR REPLACE FUNCTION public.get_all_role_page_permissions()
RETURNS TABLE (
  id uuid,
  role_key text,
  permission_key text,
  parent_key text,
  permission_type text,
  can_view boolean,
  can_edit boolean,
  description text,
  visibility text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    id,
    role_key,
    permission_key,
    parent_key,
    permission_type::text,
    can_view,
    can_edit,
    description,
    visibility
  FROM public.role_page_permissions
  ORDER BY permission_key ASC, id ASC;
$$;
