-- Drop the insecure view that exposes auth.users
DROP VIEW IF EXISTS public.employee_roles_view;

-- Drop duplicate policy if exists
DROP POLICY IF EXISTS "Owners can view employee roles" ON public.system_roles;

-- Create a secure function to get employee roles for admin (owners only)
CREATE OR REPLACE FUNCTION public.get_employee_roles_for_admin()
RETURNS TABLE (
  employee_id uuid,
  first_name text,
  last_name text,
  email text,
  job_title text,
  is_active boolean,
  auth_user_id uuid,
  role_id uuid,
  role system_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only owners can call this function
  IF NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Only owners can view employee roles';
  END IF;

  RETURN QUERY
  SELECT 
    emd.id as employee_id,
    emd.first_name,
    emd.last_name,
    emd.private_email as email,
    emd.job_title,
    emd.is_active,
    au.id as auth_user_id,
    sr.id as role_id,
    sr.role
  FROM public.employee_master_data emd
  LEFT JOIN auth.users au ON au.email = emd.private_email
  LEFT JOIN public.system_roles sr ON sr.user_id = au.id
  WHERE emd.is_active = true
  ORDER BY emd.first_name, emd.last_name;
END;
$$;

-- Create function to assign role by email (for admin use)
CREATE OR REPLACE FUNCTION public.assign_role_by_email(_email text, _role system_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _auth_user_id uuid;
BEGIN
  -- Only owners can assign roles
  IF NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Only owners can assign roles';
  END IF;

  -- Get auth user id by email
  SELECT id INTO _auth_user_id FROM auth.users WHERE email = _email LIMIT 1;
  
  IF _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', _email;
  END IF;

  -- Upsert the role
  INSERT INTO public.system_roles (user_id, role)
  VALUES (_auth_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();
END;
$$;

-- Create function to remove role by email
CREATE OR REPLACE FUNCTION public.remove_role_by_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _auth_user_id uuid;
BEGIN
  -- Only owners can remove roles
  IF NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Only owners can remove roles';
  END IF;

  -- Get auth user id by email
  SELECT id INTO _auth_user_id FROM auth.users WHERE email = _email LIMIT 1;
  
  IF _auth_user_id IS NOT NULL THEN
    DELETE FROM public.system_roles WHERE user_id = _auth_user_id;
  END IF;
END;
$$;