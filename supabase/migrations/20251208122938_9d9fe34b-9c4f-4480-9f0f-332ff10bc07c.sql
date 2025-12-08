-- Create function to get user menu permissions that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_user_granted_permissions(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(menu_item_id), ARRAY[]::text[])
  FROM public.user_menu_permissions
  WHERE user_id = _user_id AND permission_type = 'grant'
$$;