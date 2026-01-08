
-- Update get_employee_id_for_user to check auth_user_id first, then fall back to email
CREATE OR REPLACE FUNCTION public.get_employee_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- First try auth_user_id, then fall back to email match
  SELECT COALESCE(
    (SELECT id FROM public.employee_master_data WHERE auth_user_id = _user_id LIMIT 1),
    (SELECT id FROM public.employee_master_data 
     WHERE private_email = (SELECT email FROM auth.users WHERE id = _user_id) LIMIT 1)
  )
$$;
