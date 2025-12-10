-- Create a security definer function to lookup auth email by work email
CREATE OR REPLACE FUNCTION public.get_auth_email_by_work_email(_work_email text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT private_email FROM public.employee_master_data 
  WHERE LOWER(work_email) = LOWER(_work_email)
  LIMIT 1
$$;