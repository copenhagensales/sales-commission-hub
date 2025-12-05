-- Create a function to get auth user_id from employee email
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = _email LIMIT 1
$$;

-- Create a view that joins employees with their roles for admin UI
CREATE OR REPLACE VIEW public.employee_roles_view AS
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
WHERE emd.is_active = true;

-- Grant access to the view
GRANT SELECT ON public.employee_roles_view TO authenticated;

-- RLS policy function for the view (owners only)
CREATE POLICY "Owners can view employee roles" ON public.system_roles
FOR SELECT
USING (public.is_owner(auth.uid()) OR user_id = auth.uid());